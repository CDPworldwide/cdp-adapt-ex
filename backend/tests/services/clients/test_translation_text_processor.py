from app.services.clients.translation_text_processor import (
    protect_acronyms,
    restore_acronyms,
)


def test_protect_acronyms_handles_dotted_and_plain_tokens():
    prepared = protect_acronyms(
        "M.O.S.E. flood protection with Mo.S.E, MOSE, U.S.-led EPA support, and HVAC/CDP"
    )

    assert prepared.text == (
        "[[PAC_ACRONYM_0]] flood protection with [[PAC_ACRONYM_1]], "
        "[[PAC_ACRONYM_2]], [[PAC_ACRONYM_3]]-led [[PAC_ACRONYM_4]] "
        "support, and [[PAC_ACRONYM_5]]"
    )
    assert prepared.placeholders == {
        "[[PAC_ACRONYM_0]]": "M.O.S.E.",
        "[[PAC_ACRONYM_1]]": "Mo.S.E",
        "[[PAC_ACRONYM_2]]": "MOSE",
        "[[PAC_ACRONYM_3]]": "U.S.",
        "[[PAC_ACRONYM_4]]": "EPA",
        "[[PAC_ACRONYM_5]]": "HVAC/CDP",
    }


def test_protect_acronyms_handles_dotted_token_without_final_period():
    prepared = protect_acronyms("M.O.S.E flood protection and CO2 monitoring")

    assert prepared.text == (
        "[[PAC_ACRONYM_0]] flood protection and [[PAC_ACRONYM_1]] monitoring"
    )
    assert prepared.placeholders == {
        "[[PAC_ACRONYM_0]]": "M.O.S.E",
        "[[PAC_ACRONYM_1]]": "CO2",
    }


def test_restore_acronyms_replaces_placeholders_with_original_tokens():
    placeholders = {
        "[[PAC_ACRONYM_0]]": "M.O.S.E.",
        "[[PAC_ACRONYM_1]]": "EPA",
    }

    assert (
        restore_acronyms(
            "Protección [[PAC_ACRONYM_0]] con guía de [[PAC_ACRONYM_1]]",
            placeholders,
        )
        == "Protección M.O.S.E. con guía de EPA"
    )
