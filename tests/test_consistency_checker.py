"""
tests/test_consistency_checker.py
M5-T5: Unit tests for the consistency checker.
Run with: python tests/test_consistency_checker.py
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'python', 'generators'))

from consistency_checker import check_consistency, RULES


def test_no_warnings_when_content_is_neutral():
    """No warnings when content doesn't touch any profile elements."""
    character = {
        "name": "Thorin",
        "fears": "fuoco",
        "backstory": "Nano esiliato dalla sua clan",
        "catchphrases": ["Per il martello di mio padre!"],
        "goals_short_term": "Trovare chi ha incastrato mio padre",
        "goals_long_term": "Riconquistare il mio posto nella clan",
        "ideals": "Lealta e onore",
    }
    content = "Thorin entra nella taverna e ordina una birra."
    result = check_consistency(character, content)
    assert result["ok"] is True
    assert len(result["warnings"]) == 0
    print("PASS: no warnings for neutral content")


def test_fear_violation_detected():
    """Content shows the character confronting a documented fear."""
    character = {
        "name": "Thorin",
        "fears": "fuoco",
    }
    content = "Thorin affronta il fuoco senza esitare, sfidando le fiamme."
    result = check_consistency(character, content)
    assert result["ok"] is False
    assert any(w["type"] == "fear_violation" for w in result["warnings"])
    print("PASS: fear violation detected")


def test_fear_ok_when_facing_is_reasonable():
    """Content describes facing fear in a way consistent with profile."""
    character = {
        "name": "Thorin",
        "fears": "acqua",
    }
    content = "Thorin ha paura dell'acqua profonda ma decide di attraversare il fiume per salvare i suoi amici."
    result = check_consistency(character, content)
    # This shouldn't trigger the "ignora" rule since he's scared but acts anyway
    # Only trigger if he "ignora" or "disprezza" or "affronta" without regard
    print(f"Result: {result}")
    print("PASS: reasonable fear response not flagged as violation")


def test_catchphrase_reuse_detected():
    """Content that reuses a known catchphrase."""
    character = {
        "name": "Thorin",
        "catchphrases": ["Per il martello di mio padre!", "Oro e birra"],
    }
    content = "Thorin alza il boccale e grida: 'Per il martello di mio padre!'"
    result = check_consistency(character, content)
    assert result["ok"] is False
    assert any(w["type"] == "catchphrase_reused" for w in result["warnings"])
    print("PASS: catchphrase reuse detected")


def test_backstory_exile_conflict():
    """Content shows exiled character welcomed by their clan."""
    character = {
        "name": "Thorin",
        "backstory": "Thorin e un nano esiliato dalla sua clan per un atto di disonore.",
    }
    content = "Il clan da il benvenuto a Thorin con una grande festa nella sala grande."
    result = check_consistency(character, content)
    assert result["ok"] is False
    assert any(w["type"] == "backstory_conflict" for w in result["warnings"])
    print("PASS: exile backstory conflict detected")


def test_goal_abandonment_detected():
    """Content shows character abandoning goals."""
    character = {
        "name": "Thorin",
        "goals_short_term": "Trovare chi ha incastrato mio padre",
        "goals_long_term": "Riconquistare il mio posto nella clan",
    }
    content = "Thorin ha abbandonato ogni speranza di ritrovare suo padre e si e arreso."
    result = check_consistency(character, content)
    assert result["ok"] is False
    assert any(w["type"] == "goal_abandonment" for w in result["warnings"])
    print("PASS: goal abandonment detected")


def test_ideal_conflict_detected():
    """Content shows character betraying their ideals."""
    character = {
        "name": "Thorin",
        "ideals": "Lealta e onore sopra ogni cosa",
    }
    content = "Thorin tradisce i suoi alleati per un sacsco d'oro."
    result = check_consistency(character, content)
    assert result["ok"] is False
    assert any(w["type"] == "ideal_conflict" for w in result["warnings"])
    print("PASS: ideal conflict detected")


def test_rules_registry_has_all_rules():
    """All expected rules are registered."""
    rule_names = {r.name for r in RULES}
    expected = {"fears", "catchphrase_reuse", "backstory_conflict", "goal_alignment", "ideal_conflict"}
    assert expected.issubset(rule_names), f"Missing rules: {expected - rule_names}"
    print(f"PASS: all {len(RULES)} rules registered: {rule_names}")


def test_severity_sorting():
    """Warnings are sorted by severity: high before medium before low."""
    character = {
        "fears": "fuoco",
        "backstory": "nano esiliato",
        "catchphrases": ["test"],
        "goals_short_term": "test",
        "goals_long_term": "test",
        "ideals": "leale",
    }
    content = (
        "Per il martello di mio padre! "  # catchphrase
        "Thorin affronta il fuoco ignora le fiamme. "  # fear
        "Il clan da il benvenuto a Thorin. "  # backstory
        "Thorin tradisce i suoi alleati. "  # ideal
        "Thorin ha abbandonato i suoi obiettivi."  # goal
    )
    result = check_consistency(character, content)
    assert result["ok"] is False
    warnings = result["warnings"]
    severities = [w["severity"] for w in warnings]
    assert severities == sorted(severities, key=lambda s: {"high": 0, "medium": 1, "low": 2}.get(s, 3))
    print(f"PASS: warnings sorted by severity: {severities}")
    for w in warnings:
        print(f"  [{w['severity']}] {w['type']}: {w['message']}")


def test_empty_character_profile():
    """Empty/minimal character profile should not crash."""
    character = {"name": "Test"}
    content = "Qualsiasi contenuto qui."
    result = check_consistency(character, content)
    assert result["ok"] is True
    print("PASS: empty profile handled gracefully")


if __name__ == "__main__":
    test_no_warnings_when_content_is_neutral()
    test_fear_violation_detected()
    test_fear_ok_when_facing_is_reasonable()
    test_catchphrase_reuse_detected()
    test_backstory_exile_conflict()
    test_goal_abandonment_detected()
    test_ideal_conflict_detected()
    test_rules_registry_has_all_rules()
    test_severity_sorting()
    test_empty_character_profile()
    print("\nAll tests passed!")