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
        "X_PAC_0_X flood protection with X_PAC_1_X, "
        "X_PAC_2_X, X_PAC_3_X-led X_PAC_4_X "
        "support, and X_PAC_5_X"
    )
    assert prepared.placeholders == {
        "X_PAC_0_X": "M.O.S.E.",
        "X_PAC_1_X": "Mo.S.E",
        "X_PAC_2_X": "MOSE",
        "X_PAC_3_X": "U.S.",
        "X_PAC_4_X": "EPA",
        "X_PAC_5_X": "HVAC/CDP",
    }


def test_protect_acronyms_handles_dotted_token_without_final_period():
    prepared = protect_acronyms("M.O.S.E flood protection and CO2 monitoring")

    assert prepared.text == (
        "X_PAC_0_X flood protection and X_PAC_1_X monitoring"
    )
    assert prepared.placeholders == {
        "X_PAC_0_X": "M.O.S.E",
        "X_PAC_1_X": "CO2",
    }


def test_protect_acronyms_skips_lowercase_dotted_abbreviations():
    prepared = protect_acronyms("Use cooling strategies (e.g., pools) and i.e. examples.")

    assert prepared.text == "Use cooling strategies (e.g., pools) and i.e. examples."
    assert prepared.placeholders == {}


def test_protect_acronyms_skips_all_caps_phrases_without_lowercase_context():
    prepared = protect_acronyms("CONSTRUCTION DE FOURRIERE MODERNE")

    assert prepared.text == "CONSTRUCTION DE FOURRIERE MODERNE"
    assert prepared.placeholders == {}


def test_restore_acronyms_replaces_placeholders_with_original_tokens():
    placeholders = {
        "X_PAC_0_X": "M.O.S.E.",
        "X_PAC_1_X": "EPA",
    }

    assert (
        restore_acronyms(
            "Protección X_PAC_0_X con guía de X_PAC_1_X",
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
