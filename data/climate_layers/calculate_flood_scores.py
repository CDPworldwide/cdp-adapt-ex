import os
import ee
import google.auth


# Per-(floodtype, scenario) horizon years exposed downstream:
#   inuncoast historical: 2010 — present-day baseline (only projection=95
#     publishes for inuncoast historical; we pick subsidence='wtsub').
#   inuncoast rcp*:       2030/2050/2080 climate-change projections
#   inunriver historical: 1980 only — single WATCH reanalysis (the only year
#     WRI publishes for riverine historical).
#   inunriver rcp*:       2030/2050/2080
YEAR_CONFIG = {
    ("inuncoast", "historical"): [2010],
    ("inuncoast", "rcp4p5"):     [2030, 2050, 2080],
    ("inuncoast", "rcp8p5"):     [2030, 2050, 2080],
    ("inunriver", "historical"): [1980],
    ("inunriver", "rcp4p5"):     [2030, 2050, 2080],
    ("inunriver", "rcp8p5"):     [2030, 2050, 2080],
}

# Year used to derive baseline thresholds per floodtype.
BASELINE_YEAR = {"inuncoast": 2010, "inunriver": 1980}


def select_image(subset, ft, scenario, yr, rp):
    """Pick the canonical image for one (floodtype, scenario, year, rp), collapsing
    the model (by taking model ensemble) / projection (median) / subsidence dimensions:

      - inuncoast: 6 variants exist (projection ∈ {5, 50, 95} × subsidence ∈
        {nosub, wtsub}). Default to projection=50 (median SLR) and
        subsidence='wtsub' (with subsidence — more realistic for coastal cities).
      - inunriver projected: 5 GCM members; take the ensemble median across them
        to match how the NEX-GDDP-CMIP6 climate layers are aggregated.
      - inunriver historical: single WATCH reanalysis image.

    Returns (image, native_scale).
    """
    base = subset.filter(ee.Filter.eq("year", yr)) \
                 .filter(ee.Filter.eq("returnperiod", rp))

    if ft == "inuncoast":
        # WRI publishes inuncoast historical only at projection=95 (high-end SLR
        # estimate); rcp scenarios use projection=50 (median SLR).
        sea_level_pct = 95 if scenario == "historical" else 50
        img = base.filter(ee.Filter.eq("projection", sea_level_pct)) \
                  .filter(ee.Filter.eq("subsidence", "wtsub")) \
                  .select("inundation_depth") \
                  .first()
        return img, img.projection().nominalScale()

    # ft == "inunriver"
    if scenario == "historical": # only one baseline model available
        img = base.select("inundation_depth").first()
        return img, img.projection().nominalScale()

    # Riverine projected: 5 GCMs → ensemble median.

    members = base.select("inundation_depth")
    native_scale = members.first().projection().nominalScale()
    img = members.toBands().reduce(ee.Reducer.median()).rename("inundation_depth") # Avoid dropping projection with this approach
    return img, native_scale


def compute_thresholds(baseline_img, region, ignore_zero=True):
    """Quintile thresholds (p20, p40, p60, p80) derived from baseline non-zero
    pixels trimmed to the 2-98 percentile range. Mirrors the climate-layer
    scripts' compute_thresholds, evaluated server-side in EE.

    Returns the four thresholds as a tuple of ee.Numbers.
    """
    native_scale = baseline_img.projection().nominalScale()
    masked = baseline_img.updateMask(baseline_img.gt(0)) if ignore_zero else baseline_img

    bounds = masked.reduceRegion(
        reducer=ee.Reducer.percentile([2, 98]),
        geometry=region, scale=native_scale, maxPixels=1e13,
    )
    p2 = ee.Number(bounds.get("inundation_depth_p2"))
    p98 = ee.Number(bounds.get("inundation_depth_p98"))
    valid_range = masked.updateMask(masked.gte(p2).And(masked.lte(p98)))

    quintiles = valid_range.reduceRegion(
        reducer=ee.Reducer.percentile([20, 40, 60, 80]),
        geometry=region, scale=native_scale, maxPixels=1e13,
    )
    return (
        ee.Number(quintiles.get("inundation_depth_p20")),
        ee.Number(quintiles.get("inundation_depth_p40")),
        ee.Number(quintiles.get("inundation_depth_p60")),
        ee.Number(quintiles.get("inundation_depth_p80")),
    )


def classify_1to5(img, thresholds, ignore_zero=True):
    """Apply baseline thresholds to score pixels:
        0 = assessed but no flood (input == 0)
        1-5 = severity quintiles (input > p20/p40/p60/p80)
        NoData = not assessed (input was masked)
    Mirrors the climate-layer scripts' classify_1to5 but operates on ee.Image.
    """
    masked = img.updateMask(img.gt(0)) if ignore_zero else img
    classified = ee.Image(1)
    for t in thresholds:
        classified = classified.add(masked.gt(t))
    return (
        classified.updateMask(masked.mask())
                  .unmask(0)
                  .updateMask(img.mask())
                  .rename("flood_score")
    )


def main():
    GEE_PROJECT_ID = os.environ.get("GEE_PROJECT_ID")
    if not GEE_PROJECT_ID:
        raise RuntimeError("Set the GEE_PROJECT_ID environment variable to your GEE cloud project ID")

    credentials, _ = google.auth.default(
        scopes=["https://www.googleapis.com/auth/earthengine",
                "https://www.googleapis.com/auth/cloud-platform"]
    )
    ee.Initialize(credentials=credentials, project=GEE_PROJECT_ID)

    col = ee.ImageCollection("WRI/Aqueduct_Flood_Hazard_Maps/V2")

    flood_types = {
        "inuncoast": "coastal-flood",
        "inunriver": "riverine-flood",
    }

    scenarios = ["historical", "rcp4p5", "rcp8p5"]
    return_periods = [100]
    # Non-geodesic global rectangle
    region = ee.Geometry.Rectangle([-180, -90, 180, 90], proj=None, geodesic=False)

    started = 0
    skipped = 0

    for ft, folder in flood_types.items():
        ft_subset = col.filter(ee.Filter.eq("floodtype", ft))

        # Compute baseline thresholds ONCE per floodtype, then reuse across all
        # scenario × year combinations so output scores are directly comparable.
        baseline_img, native_scale = select_image(
            ft_subset.filter(ee.Filter.eq("climatescenario", "historical")),
            ft, "historical", BASELINE_YEAR[ft], return_periods[0],
        )
        thresholds = compute_thresholds(baseline_img, region)
        print(f"[{folder}] baseline {BASELINE_YEAR[ft]} thresholds derived")

        for scenario in scenarios:
            subset = ft_subset.filter(ee.Filter.eq("climatescenario", scenario))
            available_years = YEAR_CONFIG.get((ft, scenario), [])
            if not available_years:
                continue

            print(f"[{folder} / {scenario}] {len(available_years)} year(s): {available_years}")

            for yr in available_years:
                for rp in return_periods:
                    name = f"{folder}_{scenario}_{yr}_rp{rp}".lower()
                    label = f"{folder}/{name}"

                    try:
                        img, _ = select_image(subset, ft, scenario, yr, rp)
                        classified = classify_1to5(img, thresholds)

                        asset_id = f"projects/{GEE_PROJECT_ID}/assets/hazards-v2/{folder}/{name}"

                        task = ee.batch.Export.image.toAsset(
                            image=classified.byte(),
                            description=f"{folder}_{name}".replace(".", "p"),
                            assetId=asset_id,
                            crs="EPSG:4326",  # explicit; otherwise EE inherits
                                              # the source's "EPSG:4326 PLANAR"
                            scale=native_scale,
                            region=region,
                            maxPixels=1e13,
                            pyramidingPolicy={".default": "mode"},
                        )
                        task.start()
                        started += 1
                        print(f"  Started: {label}")

                    except ee.EEException as e:
                        skipped += 1
                        print(f"  [WARN] {label}: {e}")
                    except Exception as e:
                        skipped += 1
                        print(f"  [ERROR] Unexpected: {label}: {type(e).__name__}: {e}")

    print(f"\nDone. {started} task(s) started, {skipped} skipped.")


if __name__ == "__main__":
    main()