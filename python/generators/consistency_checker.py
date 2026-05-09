"""
python/generators/consistency_checker.py
M5-T5: Consistency checker — warn se qualcosa contraddice il profilo del PG.

Usage:
    echo '{"character": {...}, "content": "..."}' | python consistency_checker.py
"""

import sys
import json
from typing import Optional


# ─── Rule-based checks (immediate, no LLM needed) ────────────────────────────

class ConsistencyRule:
    def __init__(self, name: str, check_fn, severity: str = "high"):
        self.name = name
        self.check_fn = check_fn
        self.severity = severity

    def apply(self, character: dict, content: str) -> Optional[dict]:
        return self.check_fn(character, content)


def _check_fears(character: dict, content: str) -> Optional[dict]:
    fears = character.get("fears", "") or ""
    if not fears:
        return None

    fear_keywords = {
        "fuoco": ["fuoco", "fiamma", "incendio", "brucia", "caldo"],
        "acqua": ["acqua", "annegare", "affoga", "sommerso"],
        "oscurita": ["oscurita", "buio", "tenebra", "notte"],
        "altezze": ["altezza", "precipizio", "cadere"],
        "tradimento": ["tradito", "tradimento", "ingannato"],
    }

    content_lower = content.lower()

    for fear_key, keywords in fear_keywords.items():
        fear_normalized = fear_key.replace(" ", "")
        if fear_normalized in fears.lower().replace(" ", ""):
            for kw in keywords:
                if kw in content_lower:
                    positive_patterns = [
                        f"affronta {kw}",
                        f"sfida {kw}",
                        f"non ha paura di {kw}",
                        f"ignora {kw}",
                        f"disprezza {kw}",
                    ]
                    if any(pat in content_lower for pat in positive_patterns):
                        return {
                            "type": "fear_violation",
                            "severity": "high",
                            "message": f"Il contenuto mostra il PG che affronta/ignora la paura '{fear_key}' "
                                       f"in modo contradittorio rispetto al profilo.",
                            "character_fear": fear_key,
                        }
    return None


def _check_catchphrases(character: dict, content: str) -> Optional[dict]:
    catchphrases = character.get("catchphrases", []) or []
    if not catchphrases:
        return None

    content_lower = content.lower()
    for cp in catchphrases:
        if isinstance(cp, str) and len(cp) > 5 and cp.lower() in content_lower:
            return {
                "type": "catchphrase_reused",
                "severity": "low",
                "message": f"Il contenuto ripete il catchphrase gia noto del PG: '{cp}'",
                "catchphrase": cp,
            }
    return None


def _check_backstory_conflict(character: dict, content: str) -> Optional[dict]:
    backstory = character.get("backstory", "") or ""
    if not backstory:
        return None

    backstory_lower = backstory.lower()
    content_lower = content.lower()

    exile_patterns = ["esiliato", "bandito", "cacciato", "senza terra"]
    has_exile = any(p in backstory_lower for p in exile_patterns)

    if has_exile:
        welcome_patterns = ["benvenuto a", "siete i benvenuti", "festa per", "rievocato", "onore a"]
        for wp in welcome_patterns:
            if wp in content_lower and ("clan" in content_lower or "famiglia" in content_lower):
                return {
                    "type": "backstory_conflict",
                    "severity": "high",
                    "message": "Il contenuto mostra il PG accolto dalla sua gente, "
                              "ma il profilo dice che e esiliato/bandito.",
                }
    return None


def _check_goal_alignment(character: dict, content: str) -> Optional[dict]:
    goals_short = character.get("goals_short_term", "") or ""
    goals_long = character.get("goals_long_term", "") or ""

    if not goals_short and not goals_long:
        return None

    content_lower = content.lower()

    abandon_patterns = [
        "abbandona",
        "rinuncia a tutto",
        "ha dimenticato i suoi obiettivi",
        "non le importa piu",
        "ha smesso di cercare",
        "si e arreso",
    ]

    for ap in abandon_patterns:
        if ap in content_lower:
            return {
                "type": "goal_abandonment",
                "severity": "medium",
                "message": "Il contenuto mostra il PG che abbandona i suoi obiettivi senza ragione.",
            }
    return None


def _check_ideal_conflict(character: dict, content: str) -> Optional[dict]:
    ideals = character.get("ideals", "") or ""
    if not ideals:
        return None

    content_lower = content.lower()

    if "leale" in ideals.lower() or "onore" in ideals.lower():
        betrayal_patterns = ["tradisce", "inganna", "approfitta di", "mette in pericolo i suoi alleati"]
        for pat in betrayal_patterns:
            if pat in content_lower:
                return {
                    "type": "ideal_conflict",
                    "severity": "medium",
                    "message": "Il contenuto mostra un comportamento che contraddice l'ideale di lealta/onore del PG.",
                }
    return None


# ─── Registry ─────────────────────────────────────────────────────────────────

RULES = [
    ConsistencyRule("fears", _check_fears, "high"),
    ConsistencyRule("catchphrase_reuse", _check_catchphrases, "low"),
    ConsistencyRule("backstory_conflict", _check_backstory_conflict, "high"),
    ConsistencyRule("goal_alignment", _check_goal_alignment, "medium"),
    ConsistencyRule("ideal_conflict", _check_ideal_conflict, "medium"),
]


# ─── Main checker ─────────────────────────────────────────────────────────────

def check_consistency(character: dict, content: str) -> dict:
    warnings = []

    for rule in RULES:
        try:
            result = rule.apply(character, content)
            if result:
                result["rule"] = rule.name
                warnings.append(result)
        except Exception:
            pass

    severity_order = {"high": 0, "medium": 1, "low": 2}
    warnings.sort(key=lambda w: severity_order.get(w.get("severity", "low"), 3))

    return {
        "ok": len(warnings) == 0,
        "warnings": warnings,
    }


def format_warning_message(warning: dict) -> str:
    icon = {"high": "⚠️", "medium": "⚡", "low": "💡"}.get(warning.get("severity", "low"), "❓")
    return f"{icon} {warning['message']}"


# ─── CLI / stdin entrypoint ────────────────────────────────────────────────────

def main():
    try:
        stdin_data = sys.stdin.read()
        if not stdin_data.strip():
            print(json.dumps({"ok": False, "error": "No input on stdin"}))
            return

        payload = json.loads(stdin_data)
        character = payload.get("character", {})
        content = payload.get("content", "")

        result = check_consistency(character, content)
        print(json.dumps(result, ensure_ascii=False))

    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "error": f"Invalid JSON: {e}"}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))


if __name__ == "__main__":
    main()