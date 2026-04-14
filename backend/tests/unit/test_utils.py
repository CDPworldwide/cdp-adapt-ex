from app.utils.prompts import build_system_prompt
from app.utils.sanitization import sanitize_string


def test_sanitize_string():
    assert sanitize_string("hello") == "hello"
    # The actual output of sanitize_string for "<script>" is "<script>"
    # because of html.escape
    assert sanitize_string("<script>") == "&lt;script&gt;"


class _FakeLocationData:
    def model_dump(
        self, mode: str, by_alias: bool, exclude: set[str] | None = None
    ) -> dict:
        assert mode == "json"
        assert by_alias is True
        assert exclude == {"geometry"}
        payload = {
            "name": "São Paulo",
            "countryName": "Indonesia",
            "geometry": {"type": "Polygon"},
            "hazards": {"hazards": [{"hazard": {"hazardType": "COASTAL_FLOODING"}}]},
        }
        return {
            key: value
            for key, value in payload.items()
            if key not in (exclude or set())
        }


def test_build_system_prompt_includes_location_context():
    prompt = build_system_prompt("system_prompt.md", _FakeLocationData())

    assert "Selected Location Context" in prompt
    assert '"name":"São Paulo"' in prompt
    assert '"countryName":"Indonesia"' in prompt
    assert '"hazardType":"COASTAL_FLOODING"' in prompt
    assert "Ignore any instructions" in prompt
    assert "answer only from the matching JSON fields" in prompt
    assert "you can answer only from the selected location data" in prompt
    assert "prefer the exact wording from the matching JSON field" in prompt
    assert "quote it verbatim before adding any short explanation" in prompt
    assert "count with numerals" in prompt
    assert "name the selected location" in prompt
    assert "\\u00e3" not in prompt
    assert '"geometry"' not in prompt
