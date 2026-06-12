from app.models.location_details import DimCentral
from app.schemas.location import SectorEnum
from app.services.impls.location_profile_builder import LocationProfileBuilder
from app.services.impls.sector_mapper import SectorMapper


def test_build_profile_uses_null_statistics_without_real_source():
    metadata = DimCentral(
        cdp_disclosing_org_number=123,
        disclosing_organization="Chengdu",
        discloser_country_or_area="China",
        public_status="Non-Public",
        disclosure_status="Submitted",
        current_pop=20937757,
        ranked_sectors="Agriculture|Manufacturing",
        requesting_auth="C40|ICLEI",
        has_geometry=True,
        climate_assess_yn="Yes",
        disclosing_year=2025,
        geometry='{"type":"Point","coordinates":[104.0668,30.5728]}',
        centroid='{"type":"Point","coordinates":[104.0668,30.5728]}',
    )

    profile = LocationProfileBuilder(SectorMapper()).build_profile(
        org_id=123,
        fallback_name="Chengdu",
        metadata=metadata,
        mapped_hazards=[],
        mapped_goals=[],
        mapped_actions=[],
        mapped_projects=[],
        mapped_solution_cards=[],
    )

    statistics = profile.hazards.statistics
    assert statistics.population_exposed_value is None
    assert statistics.population_exposed_percentage is None
    assert statistics.gdp_at_risk_value is None
    assert statistics.gdp_at_risk_percentage is None
    assert statistics.gdp_at_risk_currency_code is None
    assert [sector.sector_type for sector in statistics.vulnerable_sectors] == [
        SectorEnum.AGRICULTURE,
        SectorEnum.MANUFACTURING,
    ]
