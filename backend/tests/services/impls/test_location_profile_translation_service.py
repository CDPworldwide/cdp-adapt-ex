import pytest

from app.schemas.location import (
    ActionStatus,
    ActionsTab,
    AdaptationAction,
    AdaptationGoal,
    Hazard,
    HazardProfile,
    HazardsTab,
    LocationProfile,
    ProjectSeekingFunding,
    RegionalStatistics,
    Sector,
    SolutionCard,
    SolutionsTab,
)
from app.services.impls.location_profile_translation_service import (
    LocationProfileTranslationService,
    normalize_translation_language,
)


class StubTranslateClient:
    def __init__(self):
        self.calls: list[dict] = []

    def translate_texts(
        self,
        texts: list[str],
        target_language: str,
        source_language: str = "en",
    ) -> list[str]:
        self.calls.append(
            {
                "texts": texts,
                "target_language": target_language,
                "source_language": source_language,
            }
        )
        return [f"{target_language}:{text}" for text in texts]


class StubTranslationCacheRepository:
    def __init__(self, cached: dict[str, str] | None = None):
        self.cached = cached or {}
        self.read_calls: list[dict] = []
        self.write_calls: list[dict] = []

    async def get_cached_translations(
        self,
        *,
        source_language: str,
        target_language: str,
        texts: list[str],
    ) -> dict[str, str]:
        self.read_calls.append(
            {
                "source_language": source_language,
                "target_language": target_language,
                "texts": texts,
            }
        )
        return {text: self.cached[text] for text in texts if text in self.cached}

    async def upsert_translations(
        self,
        *,
        source_language: str,
        target_language: str,
        translations: dict[str, str],
    ) -> None:
        self.write_calls.append(
            {
                "source_language": source_language,
                "target_language": target_language,
                "translations": translations,
            }
        )
        self.cached.update(translations)


@pytest.mark.asyncio
async def test_translate_profile_translates_manifest_fields_once():
    translate_client = StubTranslateClient()
    service = LocationProfileTranslationService(translate_client)
    profile = LocationProfile(
        organization_id=59677,
        name="City of Mountain View",
        country_name="United States of America",
        lat=37.3861,
        lng=-122.0839,
        geometry={"type": "Point", "coordinates": [-122.0839, 37.3861]},
        reporting_language="English",
        hazards=HazardsTab(
            statistics=RegionalStatistics(
                vulnerable_sectors=[
                    Sector(
                        sector_type="OTHERS",
                        other_sector_details="Local food markets",
                    )
                ]
            ),
            hazards=[
                HazardProfile(
                    hazard=Hazard(
                        hazard_type="OTHERS",
                        other_hazard_details="Custom climate anomaly",
                    ),
                    hazard_rank=1,
                    description="Mountain View faces a high drought risk.",
                    vulnerable_groups=["Children and youth", "Outdoor workers"],
                    impact="Water scarcity can increase wildfire risk.",
                    most_exposed_sectors=[
                        Sector(
                            sector_type="OTHERS",
                            other_sector_details="Local food markets",
                        )
                    ],
                )
            ],
        ),
        government_actions=ActionsTab(
            goals=[
                AdaptationGoal(
                    title="Reduce heat exposure",
                    hazards_addressed=[
                        Hazard(
                            hazard_type="OTHERS",
                            other_hazard_details="Custom climate anomaly",
                        )
                    ],
                    metric_indicator="Cooling center visits",
                    comment="Prioritize vulnerable groups",
                )
            ],
            actions=[
                AdaptationAction(
                    title="Open cooling centers",
                    status=ActionStatus(
                        status_type="OTHERS",
                        other_status_details="In local review",
                    ),
                    co_benefits=["Improved public health"],
                    hazards_addressed=[
                        Hazard(
                            hazard_type="OTHERS",
                            other_hazard_details="Custom climate anomaly",
                        )
                    ],
                    description="Provide cooling centers during heat waves.",
                    timeframe="Medium-term (2026-2050)",
                    resilience_enhanced=["Community resilience"],
                    impacted_sectors=[
                        Sector(
                            sector_type="OTHERS",
                            other_sector_details="Local services",
                        )
                    ],
                )
            ],
            projects=[
                ProjectSeekingFunding(
                    title="Water reuse project",
                    description="Expand recycled water access.",
                    project_area="Water conservation",
                    finance_status="Seeking funding",
                    finance_model=["Grant funding"],
                    hazards_addressed=[
                        Hazard(
                            hazard_type="OTHERS",
                            other_hazard_details="Custom climate anomaly",
                        )
                    ],
                )
            ],
        ),
        solutions=SolutionsTab(
            solutions={
                "ENGINEERED_BUILT_ENVIRONMENT": [
                    SolutionCard(
                        solution="Green roofs",
                        solution_hazards_addressed=[
                            Hazard(
                                hazard_type="OTHERS",
                                other_hazard_details="Custom climate anomaly",
                            )
                        ],
                        peer_actions=[
                            {
                                "peer_name": "San Jose",
                                "action": {
                                    "title": "Install green roofs",
                                    "description": "Add vegetation to public buildings.",
                                    "timeframe": "Medium-term",
                                    "status": {
                                        "status_type": "OTHERS",
                                        "other_status_details": "Being scoped",
                                    },
                                    "co_benefits": ["Reduced urban heat"],
                                    "resilience_enhanced": [
                                        "Infrastructure resilience"
                                    ],
                                    "hazards_addressed": [
                                        {
                                            "hazard_type": "OTHERS",
                                            "other_hazard_details": (
                                                "Custom climate anomaly"
                                            ),
                                        }
                                    ],
                                    "impacted_sectors": [
                                        {
                                            "sector_type": "OTHERS",
                                            "other_sector_details": "Public works",
                                        }
                                    ],
                                },
                            }
                        ],
                    )
                ]
            }
        ),
    )

    translated = await service.translate_profile(profile, "Spanish")

    assert translated.reporting_language == "es"
    assert translated.name == "City of Mountain View"
    assert translated.hazards.hazards[0].description == (
        "es:Mountain View faces a high drought risk."
    )
    assert translated.hazards.hazards[0].vulnerable_groups == [
        "es:Children and youth",
        "es:Outdoor workers",
    ]
    assert translated.hazards.hazards[0].impact == (
        "es:Water scarcity can increase wildfire risk."
    )
    assert translated.government_actions.actions[0].status.other_status_details == (
        "es:In local review"
    )
    assert translated.government_actions.actions[0].timeframe == (
        "es:Medium-term (2026-2050)"
    )
    assert translated.government_actions.projects[0].finance_model == [
        "es:Grant funding"
    ]
    solution = translated.solutions.solutions["ENGINEERED_BUILT_ENVIRONMENT"][0]
    assert solution.solution == "es:Green roofs"
    assert solution.peer_actions[0].peer_name == "es:San Jose"
    assert solution.peer_actions[0].action.description == (
        "es:Add vegetation to public buildings."
    )
    assert solution.peer_actions[0].action.timeframe == "es:Medium-term"
    assert profile.hazards.hazards[0].description == (
        "Mountain View faces a high drought risk."
    )

    assert len(translate_client.calls) == 1
    call = translate_client.calls[0]
    assert call["target_language"] == "es"
    assert call["source_language"] == "en"
    assert call["texts"].count("Custom climate anomaly") == 1
    assert call["texts"].count("Local food markets") == 1


@pytest.mark.asyncio
async def test_translate_profile_reuses_persistent_cache_before_google():
    translate_client = StubTranslateClient()
    translation_cache_repository = StubTranslationCacheRepository(
        {"Children and youth": "es:cached children"}
    )
    service = LocationProfileTranslationService(
        translate_client, translation_cache_repository
    )
    profile = LocationProfile(
        organization_id=1,
        name="Mountain View",
        country_name="United States of America",
        lat=37.3861,
        lng=-122.0839,
        geometry={"type": "Point", "coordinates": [-122.0839, 37.3861]},
        reporting_language="en",
        hazards=HazardsTab(
            statistics=RegionalStatistics(),
            hazards=[
                HazardProfile(
                    hazard=Hazard(hazard_type="DROUGHT"),
                    hazard_rank=1,
                    description="Drought risk",
                    vulnerable_groups=["Children and youth"],
                )
            ],
        ),
        government_actions=ActionsTab(),
        solutions=SolutionsTab(),
    )

    translated = await service.translate_profile(profile, "es")

    assert translated.hazards.hazards[0].vulnerable_groups == ["es:cached children"]
    assert translated.hazards.hazards[0].description == "es:Drought risk"
    assert translate_client.calls == [
        {
            "texts": ["Drought risk"],
            "target_language": "es",
            "source_language": "en",
        }
    ]
    assert translation_cache_repository.write_calls == [
        {
            "source_language": "en",
            "target_language": "es",
            "translations": {"Drought risk": "es:Drought risk"},
        }
    ]


@pytest.mark.asyncio
async def test_translate_profile_ignores_cached_translations_with_missing_acronyms():
    translate_client = StubTranslateClient()
    translation_cache_repository = StubTranslationCacheRepository(
        {"EPA resilience plan": "es:cached resilience plan"}
    )
    service = LocationProfileTranslationService(
        translate_client, translation_cache_repository
    )
    profile = LocationProfile(
        organization_id=1,
        name="Mountain View",
        country_name="United States of America",
        lat=37.3861,
        lng=-122.0839,
        geometry={"type": "Point", "coordinates": [-122.0839, 37.3861]},
        reporting_language="en",
        hazards=HazardsTab(
            statistics=RegionalStatistics(),
            hazards=[
                HazardProfile(
                    hazard=Hazard(hazard_type="DROUGHT"),
                    hazard_rank=1,
                    description="EPA resilience plan",
                )
            ],
        ),
        government_actions=ActionsTab(),
        solutions=SolutionsTab(),
    )

    translated = await service.translate_profile(profile, "es")

    assert translated.hazards.hazards[0].description == "es:EPA resilience plan"
    assert translate_client.calls == [
        {
            "texts": ["EPA resilience plan"],
            "target_language": "es",
            "source_language": "en",
        }
    ]
    assert translation_cache_repository.write_calls == [
        {
            "source_language": "en",
            "target_language": "es",
            "translations": {"EPA resilience plan": "es:EPA resilience plan"},
        }
    ]


@pytest.mark.asyncio
async def test_translate_profile_returns_original_when_target_matches_source():
    translate_client = StubTranslateClient()
    service = LocationProfileTranslationService(translate_client)
    profile = LocationProfile(
        organization_id=1,
        name="London",
        country_name="United Kingdom",
        lat=51.5074,
        lng=-0.1278,
        geometry={"type": "Point", "coordinates": [0, 0]},
        reporting_language="en",
        hazards=HazardsTab(statistics=RegionalStatistics()),
        government_actions=ActionsTab(),
        solutions=SolutionsTab(),
    )

    translated = await service.translate_profile(profile, "en")

    assert translated is profile
    assert translate_client.calls == []


@pytest.mark.asyncio
async def test_translate_profile_translates_english_normalized_fields_for_japanese_reporters():
    translate_client = StubTranslateClient()
    service = LocationProfileTranslationService(translate_client)
    profile = LocationProfile(
        organization_id=3203,
        name="City of Sapporo",
        country_name="Japan",
        lat=43.0618,
        lng=141.3545,
        geometry={"type": "Point", "coordinates": [141.3545, 43.0618]},
        reporting_language="Japanese",
        hazards=HazardsTab(
            statistics=RegionalStatistics(),
            hazards=[
                HazardProfile(
                    hazard=Hazard(hazard_type="EXTREME_HEAT"),
                    hazard_rank=1,
                    description="Sapporo faces a high risk of extreme heat.",
                    vulnerable_groups=["Elderly", "Outdoor workers"],
                )
            ],
        ),
        government_actions=ActionsTab(),
        solutions=SolutionsTab(),
    )

    translated = await service.translate_profile(profile, "ja")

    assert translated.reporting_language == "ja"
    assert translated.hazards.hazards[0].description == (
        "ja:Sapporo faces a high risk of extreme heat."
    )
    assert translated.hazards.hazards[0].vulnerable_groups == [
        "ja:Elderly",
        "ja:Outdoor workers",
    ]
    assert translate_client.calls == [
        {
            "texts": [
                "Sapporo faces a high risk of extreme heat.",
                "Elderly",
                "Outdoor workers",
            ],
            "target_language": "ja",
            "source_language": "en",
        }
    ]


def test_normalize_translation_language_handles_supported_aliases():
    assert normalize_translation_language("Spanish") == "es"
    assert normalize_translation_language("pt-BR") == "pt"
    assert normalize_translation_language("zh-Hant") == "zh"
    assert normalize_translation_language(None) == "en"
