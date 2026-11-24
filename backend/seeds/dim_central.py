from geoalchemy2 import WKTElement

from app.models.location_details import DimCentral
from seeds.discloser import HAZARD, ORG_ID, ORG_NAME, YEAR

ROWS = [
    DimCentral(
        cdp_disclosing_org_number=ORG_ID,
        disclosing_year=YEAR,
        disclosing_organization=ORG_NAME,
        disclosing_org_type="City",
        discloser_country_or_area="United States of America",
        public_status="Public",
        disclosure_status="Submitted",
        current_pop=84463,
        reporting_language="English",
        ranked_hazards=HAZARD,
        has_geometry=True,
        # A small square standing in for the real boundary.
        geometry=WKTElement(
            "POLYGON((-122.13 37.35,-122.03 37.35,-122.03 37.45,"
            "-122.13 37.45,-122.13 37.35))",
            srid=4326,
        ),
        centroid=WKTElement("POINT(-122.08 37.40)", srid=4326),
    ),
    # Second pin on the other side of the world, so the map isn't zoomed in on one.
    DimCentral(
        cdp_disclosing_org_number=31114,
        disclosing_year=YEAR,
        disclosing_organization="City of Sydney",
        disclosing_org_type="City",
        discloser_country_or_area="Australia",
        public_status="Public",
        disclosure_status="Submitted",
        current_pop=237278,
        reporting_language="English",
        has_geometry=True,
        geometry=WKTElement(
            "POLYGON((151.15 -33.94,151.25 -33.94,151.25 -33.84,"
            "151.15 -33.84,151.15 -33.94))",
            srid=4326,
        ),
        centroid=WKTElement("POINT(151.20 -33.89)", srid=4326),
    ),
]
