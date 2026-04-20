import os
import ee
import google.auth


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
        'inuncoast': 'Coastal-Flood',
        'inunriver': 'Riverine-Flood'
    }

    scenarios = ['historical', 'rcp4p5', 'rcp8p5']
    return_periods = [100]
    region = ee.Geometry.BBox(-180, -90, 180, 90)

    started = 0
    skipped = 0

    for ft, folder in flood_types.items():
        # Filter once per flood type, reuse for each scenario
        ft_subset = col.filter(ee.Filter.eq('floodtype', ft))

        for scenario in scenarios:
            subset = ft_subset.filter(ee.Filter.eq('climatescenario', scenario))

            available_years = [2030, 2050, 2080]

            print(f"[{folder} / {scenario}] {len(available_years)} year(s): {available_years}")

            for yr in available_years:
                for rp in return_periods:
                    name = f"{folder}_{scenario}_{yr}_rp{rp}".lower()
                    label = f"{folder}/{name}"

                    try:
                        img = subset.filter(ee.Filter.eq('year', yr)) \
                                    .filter(ee.Filter.eq('returnperiod', rp)) \
                                    .select('inundation_depth') \
                                    .first()

                        # 1. Drop 0s
                        masked_img = img.updateMask(img.gt(0))
                        native_scale = img.projection().nominalScale()

                        # 2. Get 2nd and 98th percentiles (server-side ee.Numbers)
                        bounds = masked_img.reduceRegion(
                            reducer=ee.Reducer.percentile([2, 98]),
                            geometry=region,
                            scale=native_scale,
                            maxPixels=1e13
                        )

                        p2 = ee.Number(bounds.get('inundation_depth_p2'))
                        p98 = ee.Number(bounds.get('inundation_depth_p98'))

                        # 3. Define the 'Valid Range' for quintile calculation
                        valid_range_img = masked_img.updateMask(masked_img.gte(p2).And(masked_img.lte(p98)))

                        # 4. Calculate Quintiles (20, 40, 60, 80) based ONLY on that range
                        quintiles = valid_range_img.reduceRegion(
                            reducer=ee.Reducer.percentile([20, 40, 60, 80]),
                            geometry=region,
                            scale=native_scale,
                            maxPixels=1e13
                        )

                        # 5. Classification (1-5 on flooded pixels only)
                        thresholds = [
                            ee.Number(quintiles.get('inundation_depth_p20')),
                            ee.Number(quintiles.get('inundation_depth_p40')),
                            ee.Number(quintiles.get('inundation_depth_p60')),
                            ee.Number(quintiles.get('inundation_depth_p80')),
                        ]
                        classified = ee.Image(1)
                        for t in thresholds:
                            classified = classified.add(masked_img.gt(t))
                        # 0 = no flood, 1-5 = severity, NoData = not assessed
                        classified = classified.updateMask(masked_img.mask()) \
                                               .unmask(0) \
                                               .updateMask(img.mask()) \
                                               .rename('flood_score')

                        asset_id = f"projects/{GEE_PROJECT_ID}/assets/hazards/{folder}/{name}"

                        # 6. Create and start the export task
                        task = ee.batch.Export.image.toAsset(
                            image=classified.byte(),
                            description=f"{folder}_{name}".replace('.', 'p'),
                            assetId=asset_id,
                            scale=native_scale,
                            region=region,
                            maxPixels=1e13,
                            pyramidingPolicy={'.default': 'mode'}
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
