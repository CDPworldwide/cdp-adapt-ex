from app.services.clients.translation_text_processor import (
    protect_acronyms,
    restore_acronyms,
    validate_restored_acronyms,
)


def test_protect_acronyms_handles_dotted_and_plain_tokens():
    prepared = protect_acronyms(
        "M.O.S.E. flood protection with Mo.S.E, MOSE, U.S.-led EPA support, and HVAC/CDP"
    )

    assert prepared.text == (
        "{PACACRONYM0} flood protection with {PACACRONYM1}, "
        "{PACACRONYM2}, {PACACRONYM3}-led {PACACRONYM4} "
        "support, and {PACACRONYM5}"
    )
    assert prepared.placeholders == {
        "{PACACRONYM0}": "M.O.S.E.",
        "{PACACRONYM1}": "Mo.S.E",
        "{PACACRONYM2}": "MOSE",
        "{PACACRONYM3}": "U.S.",
        "{PACACRONYM4}": "EPA",
        "{PACACRONYM5}": "HVAC/CDP",
    }


def test_protect_acronyms_handles_dotted_token_without_final_period():
    prepared = protect_acronyms("M.O.S.E flood protection and CO2 monitoring")

    assert prepared.text == (
        "{PACACRONYM0} flood protection and {PACACRONYM1} monitoring"
    )
    assert prepared.placeholders == {
        "{PACACRONYM0}": "M.O.S.E",
        "{PACACRONYM1}": "CO2",
    }


def test_protect_acronyms_skips_all_caps_phrases_without_lowercase_context():
    prepared = protect_acronyms("CONSTRUCTION DE FOURRIERE MODERNE")

    assert prepared.text == "CONSTRUCTION DE FOURRIERE MODERNE"
    assert prepared.placeholders == {}


def test_restore_acronyms_replaces_placeholders_with_original_tokens():
    placeholders = {
        "{PACACRONYM0}": "M.O.S.E.",
        "{PACACRONYM1}": "EPA",
    }

    assert (
        restore_acronyms(
            "Protección {PACACRONYM0} con guía de {PACACRONYM1}",
            placeholders,
        )
        == "Protección M.O.S.E. con guía de EPA"
    )


def test_validate_restored_acronyms_detects_missing_and_mutated_tokens():
    validation = validate_restored_acronyms(
        "EPA funds M.O.S.E. and HVAC/CDP upgrades",
        "EPA funds MOSE and HVAC-CDP upgrades",
    )

    assert not validation.is_valid
    assert validation.missing == ["M.O.S.E.", "HVAC/CDP"]
    assert validation.mutated == ["MOSE", "HVAC-CDP"]


def test_validate_restored_acronyms_accepts_repeated_tokens():
    validation = validate_restored_acronyms("EPA and EPA", "EPA y EPA")

    assert validation.is_valid
