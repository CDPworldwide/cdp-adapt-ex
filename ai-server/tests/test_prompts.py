import json

import pytest

from app import prompts


class StubResponse:
    def __init__(self, text: str):
        self.text = text

    def raise_for_status(self):
        return None


def teardown_function():
    prompts.load_system_prompt.cache_clear()


def test_load_system_prompt_uses_system_prompt_url(monkeypatch):
    requested_urls = []

    def stub_get(url, timeout):
        requested_urls.append((url, timeout))
        return StubResponse("# Remote system prompt")

    monkeypatch.setenv("SYSTEM_PROMPT", "https://pub.example.com/system_prompt.md")
    monkeypatch.setattr(prompts.httpx, "get", stub_get)
    prompts.load_system_prompt.cache_clear()

    assert prompts.load_system_prompt() == "# Remote system prompt"
    assert requested_urls == [
        (
            "https://pub.example.com/system_prompt.md",
            prompts.PROMPT_FETCH_TIMEOUT_SECONDS,
        )
    ]


def test_remote_system_prompt_fetch_is_cached(monkeypatch):
    calls = 0

    def stub_get(url, timeout):
        nonlocal calls
        calls += 1
        return StubResponse(f"# Remote system prompt {calls}")

    monkeypatch.setenv("SYSTEM_PROMPT", "https://pub.example.com/system_prompt.md")
    monkeypatch.setattr(prompts.httpx, "get", stub_get)
    prompts.load_system_prompt.cache_clear()

    assert prompts.load_system_prompt() == "# Remote system prompt 1"
    assert prompts.load_system_prompt() == "# Remote system prompt 1"
    assert calls == 1


def test_local_system_prompt_file_reloads_without_cache():
    prompt_path = (
        prompts.Path(__file__).parents[1] / "app" / "prompts" / "_tmp_test_prompt.md"
    )
    try:
        prompt_path.write_text("first prompt", encoding="utf-8")
        assert prompts.load_system_prompt("_tmp_test_prompt.md") == "first prompt"

        prompt_path.write_text("second prompt", encoding="utf-8")
        assert prompts.load_system_prompt("_tmp_test_prompt.md") == "second prompt"
    finally:
        prompt_path.unlink(missing_ok=True)


def test_system_prompt_url_does_not_override_named_prompt(monkeypatch):
    def stub_get(url, timeout):
        raise AssertionError("named prompts should still load from disk")

    monkeypatch.setenv("SYSTEM_PROMPT", "https://pub.example.com/system_prompt.md")
    monkeypatch.setattr(prompts.httpx, "get", stub_get)
    prompts.load_system_prompt.cache_clear()

    prompt = prompts.load_system_prompt("suggest_follow_ups.md")

    assert "follow-up" in prompt


def test_system_prompt_env_requires_http_url(monkeypatch):
    monkeypatch.setenv("SYSTEM_PROMPT", "app/prompts/system_prompt.md")
    prompts.load_system_prompt.cache_clear()

    with pytest.raises(ValueError, match="SYSTEM_PROMPT must be an http"):
        prompts.load_system_prompt()


def test_build_system_prompt_uses_remote_system_prompt(monkeypatch):
    monkeypatch.setenv("SYSTEM_PROMPT", "https://pub.example.com/system_prompt.md")
    monkeypatch.setattr(
        prompts.httpx,
        "get",
        lambda url, timeout: StubResponse("Remote prompt"),
    )
    prompts.load_system_prompt.cache_clear()

    system_prompt = prompts.build_system_prompt(
        {"name": "Mumbai", "geometry": {"type": "Point"}}
    )

    assert system_prompt.startswith("Remote prompt")
    assert '"name":"Mumbai"' in system_prompt
    assert "geometry" not in system_prompt


def test_build_system_prompt_labels_platform_context_and_strips_internal_fields():
    system_prompt = prompts.build_system_prompt(
        {
            "name": "Queretaro",
            "geometry": {"type": "Point"},
            "hazards": {
                "hazards": [
                    {
                        "hazardRank": 1,
                        "hazard": {"hazardType": "DROUGHT"},
                    }
                ]
            },
        }
    )
    context_json = system_prompt.split("```json\n", 1)[1]

    assert "endpoint-shaped platform data" in system_prompt
    assert "Aggregate statistics" in system_prompt
    assert "dataProvenance" in context_json
    assert "hazardRank" not in context_json
    assert "geometry" not in context_json
    assert '"hazardType":"DROUGHT"' in context_json


def test_build_system_prompt_scopes_context_to_hazards_tab():
    system_prompt = prompts.build_system_prompt(
        {
            "organizationId": 1,
            "name": "Test City",
            "countryName": "Test Country",
            "hazards": {
                "statistics": {"populationExposedPercentage": 50},
                "hazards": [{"hazard": {"hazardType": "DROUGHT"}}],
            },
            "governmentActions": {"actions": [{"title": "Action"}]},
            "solutions": {"solutions": {"BEHAVIOURAL": [{"solution": "Solution"}]}},
        },
        context_area="hazards",
    )
    context = json.loads(system_prompt.split("```json\n", 1)[1].removesuffix("\n```"))

    assert list(context.keys()) == [
        "organizationId",
        "name",
        "countryName",
        "contextArea",
        "hazards",
        "dataProvenance",
    ]
    assert context["contextArea"] == "hazards"
    assert context["dataProvenance"]["includedTopLevelFields"] == [
        "organizationId",
        "name",
        "countryName",
        "contextArea",
        "hazards",
    ]
    assert "governmentActions" not in context
    assert "solutions" not in context


def test_build_system_prompt_scopes_context_to_actions_tab():
    system_prompt = prompts.build_system_prompt(
        {
            "organizationId": 1,
            "name": "Test City",
            "hazards": {"hazards": [{"hazard": {"hazardType": "DROUGHT"}}]},
            "governmentActions": {
                "actions": [
                    {
                        "title": "Action",
                        "coBenefits": ["Community participation"],
                        "resilienceEnhanced": [
                            "Social: Increased security/protection for poor/vulnerable populations"
                        ],
                    }
                ]
            },
            "solutions": {"solutions": {"BEHAVIOURAL": [{"solution": "Solution"}]}},
        },
        context_area="actions",
    )
    context = json.loads(system_prompt.split("```json\n", 1)[1].removesuffix("\n```"))

    assert context["contextArea"] == "actions"
    assert "governmentActions" in context
    assert "coBenefits" not in context["governmentActions"]["actions"][0]
    assert "resilienceEnhanced" not in context["governmentActions"]["actions"][0]
    assert "hazards" not in context
    assert "solutions" not in context


def test_build_system_prompt_sorts_projects_by_funding_needed():
    system_prompt = prompts.build_system_prompt(
        {
            "organizationId": 1,
            "name": "Test City",
            "governmentActions": {
                "actions": [],
                "goals": [],
                "projects": [
                    {"title": "Small", "totalNeeded": 50},
                    {"title": "Large", "totalNeeded": 500},
                    {"title": "Medium", "totalNeeded": 100},
                ],
            },
        },
        context_area="actions",
    )
    context = json.loads(system_prompt.split("```json\n", 1)[1].removesuffix("\n```"))

    assert [
        project["title"] for project in context["governmentActions"]["projects"]
    ] == ["Large", "Medium", "Small"]


def test_build_system_prompt_scopes_context_to_solutions_tab():
    system_prompt = prompts.build_system_prompt(
        {
            "organizationId": 1,
            "name": "Test City",
            "hazards": {"hazards": [{"hazard": {"hazardType": "DROUGHT"}}]},
            "governmentActions": {"actions": [{"title": "Action"}]},
            "solutions": {"solutions": {"BEHAVIOURAL": [{"solution": "Solution"}]}},
        },
        context_area="solutions",
    )
    context = json.loads(system_prompt.split("```json\n", 1)[1].removesuffix("\n```"))

    assert context["contextArea"] == "solutions"
    assert "solutions" in context
    assert "hazards" not in context
    assert "governmentActions" not in context


def test_build_system_prompt_trims_solution_peer_examples():
    long_description = "x" * 2000
    system_prompt = prompts.build_system_prompt(
        {
            "organizationId": 1,
            "name": "Test City",
            "solutions": {
                "solutions": {
                    "BEHAVIOURAL": [
                        {
                            "solution": f"Solution {index}",
                            "solutionCategory": "BEHAVIOURAL",
                            "peerActions": [
                                {
                                    "peerName": f"Peer {peer_index}",
                                    "action": {
                                        "title": "Action",
                                        "description": long_description,
                                        "coBenefits": [
                                            "benefit 1",
                                            "benefit 2",
                                            "benefit 3",
                                            "benefit 4",
                                            "benefit 5",
                                            "benefit 6",
                                        ],
                                    },
                                }
                                for peer_index in range(4)
                            ],
                        }
                        for index in range(5)
                    ]
                }
            },
        }
    )
    context_json = system_prompt.split("```json\n", 1)[1]
    context = json.loads(context_json.removesuffix("\n```"))

    cards = context["solutions"]["solutions"]["BEHAVIOURAL"]
    assert len(cards) == prompts.MAX_SOLUTION_CARDS_PER_CATEGORY
    assert len(cards[0]["peerActions"]) == prompts.MAX_PEER_ACTIONS_PER_SOLUTION
    assert cards[0]["peerActions"][0]["action"]["description"].endswith(
        "... [truncated]"
    )
    assert "coBenefits" not in cards[0]["peerActions"][0]["action"]


def test_build_system_prompt_limits_solution_cards_globally_by_priority():
    system_prompt = prompts.build_system_prompt(
        {
            "organizationId": 1,
            "name": "Test City",
            "solutions": {
                "solutions": {
                    f"CATEGORY_{category_index}": [
                        {
                            "solution": f"Solution {category_index}-{card_index}",
                            "solutionCategory": f"CATEGORY_{category_index}",
                            "hasLocalAction": category_index == 8,
                            "pctPeerTakingAction": card_index,
                            "peerActions": [{"peerName": "Peer", "action": {}}],
                        }
                        for card_index in range(4)
                    ]
                    for category_index in range(9)
                }
            },
        }
    )
    context_json = system_prompt.split("```json\n", 1)[1]
    context = json.loads(context_json.removesuffix("\n```"))
    solution_categories = context["solutions"]["solutions"]
    cards = [
        card
        for category_cards in solution_categories.values()
        for card in category_cards
    ]

    assert len(cards) == prompts.MAX_SOLUTION_CARDS_TOTAL
    assert all(
        len(category_cards) <= prompts.MAX_SOLUTION_CARDS_PER_CATEGORY
        for category_cards in solution_categories.values()
    )
    assert "Solution 8-3" in [card["solution"] for card in cards]


def test_system_prompt_contains_review_grounding_guardrails():
    prompt = prompts.load_system_prompt()

    assert 'Do not use "CSTAR" in user-facing answers' in prompt
    assert "CDP-ICLEI Track disclosure" in prompt
    assert "CDP States & Regions Questionnaire disclosure" in prompt
    assert 'Do not say a city, state, or region "ranked" hazards' in prompt
    assert "Do not substitute population exposure, magnitude" in prompt
    assert (
        "how likely each hazard is to occur and how severe its impact could be"
        in prompt
    )
    assert 'do not begin with "Yes"' in prompt
    assert 'For broad "climate context" questions' in prompt
    assert "aggregate structured data for the location" in prompt
    assert "the platform data contains" in prompt
    assert "I cannot assign a climate action score or ranking" in prompt
    assert "If the user asks how a displayed hazard ordering was created" in prompt
    assert "do not append the generic climate score/ranking refusal" in prompt
    assert "do not list the ordered hazards unless the user explicitly asks" in prompt
    assert "Do not output raw co-benefit or resilience dropdown labels" in prompt
    assert "For projects seeking funding, show at most 5 projects" in prompt
    assert "End every project line with a footnote marker" in prompt
    assert "When users ask about peer solutions" in prompt
    assert "Keep peer-solution answers under 120 words total" in prompt
    assert "cite every numbered evidence item" in prompt
    assert "Do not wait until the final summary sentence" in prompt
    assert "Never include a `Sources:` block with no inline footnote markers" in prompt
    assert "always answer with footnotes" in prompt
    assert "If the user did not ask a substantive question" in prompt
    assert "CSTAR Database" not in prompt
    assert "2024 CSTAR disclosure" not in prompt
