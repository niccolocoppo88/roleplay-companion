"""
consistency_checker.py
M5-T5: Rule-based consistency checker — warns if content contradicts character profile.

Input (JSON on stdin):
  {
    "character": {
        "name": "...",
        "backstory": "...",
        "fears": {"surface": "...", "deep": "...", "whatTheyAvoid": "..."},
        "motivations": {"primary": "...", "secondary": "...", "unconscious": "..."},
        "dreams": {"shortTerm": "...", "longTerm": "...", "hidden": "..."},
        "catchphrases": ["...", ...],
        "goals_short_term": "...",
        "goals_long_term": "...",
    },
    "content": "..."
  }

Output (JSON on stdout):
  {
    "ok": true|false,
    "warnings": [
      {
        "rule": "fear_contradiction",
        "severity": "high|medium|low",
        "message": "Human-readable warning in Italian",
        "detail": "Specific excerpt or analysis",
        "profile_field": "fears.surface"
      },
      ...
    ]
  }
"""
from __future__ import annotations

import json
import re
import sys
import textwrap
from typing import Any, Optional


# ─── Severity constants ──────────────────────────────────────────────────────────
SEVERITY_HIGH = "high"
SEVERITY_MEDIUM = "medium"
SEVERITY_LOW = "low"

# ─── Fear keyword dictionaries ──────────────────────────────────────────────────
# Italian fear triggers — phrases that indicate the character is experiencing
# or confronting something they fear.
_FEAR_TRIGGER_PATTERNS: dict[str, list[str]] = {
    "fire": [
        r"\bfuoco\b", r"\b incendio\b", r"\b fiamme\b", r"\b bruciare\b",
        r"\b ardere\b", r"\b infuocata?\b",
    ],
    "darkness": [
        r"\bbuio\b", r"\boscuro\b", r"\btenebra\b", r"\b ombra\b",
        r"\bnotte\b", r"\btenebr\b",
    ],
    "betrayal": [
        r"\b tradiment\b", r"\b tradire\b", r"\b traditor\b",
        r"\b ingannare\b", r"\b inganno\b", r"\b slealt\b",
        r"\bconspirazion\b", r"\b tradì\b", r"\b tradisce\b",
    ],
    "death": [
        r"\b morte\b", r"\b morir\b", r"\b deced\b", r"\b uccid\b",
        r"\b omicidi\b", r"\b sepolt\b", r"\b tomba\b", r"\b teschio\b",
        r"\b scheletr\b",
    ],
    "heights": [
        r"\b altezza\b", r"\b precipizi\b", r"\b cadere\b", r"\b-vuoto\b",
        r"\bstrapiomb\b", r"\bbalconc\b", r"\btorre\b",
    ],
    "water": [
        r"\b affogare\b", r"\b annegare\b", r"\b acqua alta\b",
        r"\b profond\b", r"\b abyss\b", r"\b voragin\b",
    ],
    "enclosed": [
        r"\b claustro\b", r"\b chiuso\b", r"\b prigion\b",
        r"\b cella\b", r"\b trappola\b", r"\b intrappolato\b",
    ],
    "magic": [
        r"\b magia\b", r"\b incantament\b", r"\b stregon\b",
        r"\b arcano\b", r"\b maledizion\b", r"\b sortilegi\b",
    ],
    "dragons": [
        r"\b drago\b", r"\b dracon\b", r"\b bestia\b",
        r"\b creatura\b", r"\b mostro\b", r"\b orrore\b",
    ],
}

# Inverse actions: what the character would NEVER do because of their fear
# These patterns check if the content describes the character freely doing
# the feared thing (no panic, no hesitation).
_INVERSE_ACTION_PATTERNS: dict[str, list[tuple[str, str]]] = {
    # (trigger_regex, inverse_action_regex) — fires when trigger is absent
    # but we look for "character does X freely despite fear"
    "fire": [
        (r"\bfuoco\b", r"\b cammina\b.*\bfuoco\b|\b attraversa\b.*\bfuoco\b"
         r"|\bappicca\b|\baccende\b|\bmane\u0219\b|\bruota\b.*\bfiamme\b"),
    ],
}

# ─── Backstory conflict detection ─────────────────────────────────────────────
# Detect key elements in backstory and check if content contradicts them.
_BACKSTORY_CONFLICT_PAIRS: list[tuple[str, re.Pattern, re.Pattern]] = [
    # (description, backstory_keyword, contradiction_keyword)
    (
        "Character was betrayed but now trusts too easily",
        re.compile(r"\btradit\b|\bingannat\b|\b tradiment\b", re.I),
        re.compile(r"\b si fida\b|\b fiducia\b|\b credete\b", re.I),
    ),
    (
        "Character lost someone but shows no grief",
        re.compile(r"\b perdut\b|\b mort\b|\b scomparso\b|\b defunt\b", re.I),
        re.compile(r"\b nessun rimpianto\b|\b non mi importa\b|\b felice\b", re.I),
    ),
    (
        "Character is exiled but doesn't show desire to return",
        re.compile(r"\b esiliat\b|\b bandito\b|\b cacciato\b", re.I),
        re.compile(r"\b resto qui\b|\b non torner\b", re.I),
    ),
]


def _build_fear_patterns(fear_text: str) -> list[re.Pattern]:
    """
    Extract meaningful keyword patterns from fear text.
    E.g. "Il fuoco e le fiamme" -> keywords ["fuoco", "fiamme"]
    Returns one combined regex that matches any of the keywords.
    """
    if not fear_text:
        return []

    # Common Italian stop words to filter out
    STOP_WORDS = frozenset([
        "a", "ab", "al", "allo", "ai", "gli", "am", "an", "au",
        "che", "chi", "ci", "co", "con", "cos", "da", "dai", "dal",
        "dalla", "dello", "dan", "de", "dei", "del", "della",
        "di", "dove", "e", "eb", "ed", "ei", "ella", "eran",
        "ess", "fa", "fatto", "fu", "fui", "fuor", "ha", "han",
        "ho", "i", "il", "in", "io", "la", "le", "lei", "li",
        "lo", "mai", "ma", "me", "mi", "mia", "mo", "nel",
        "nella", "nello", "ni", "no", "noi", "non", "o", "per",
        "qua", "qual", "quando", "quante", "quanti", "que",
        "quest", "qui", "quo", "sa", "se", "sei", "son", "sta",
        "stai", "su", "sua", "te", "ti", "tra", "tu", "tua",
        "un", "una", "uno", "va", "vi", "voi", "vol", "w", "z",
        "anche", "questo", "questa", "quello", "quella", "solo",
    ])

    # Remove punctuation
    cleaned = re.sub(r"[^\w\s]", " ", fear_text)
    words = cleaned.split()
    keywords = [w for w in words if w.lower() not in STOP_WORDS and len(w) >= 3]
    if not keywords:
        return []

    escaped = [re.escape(k) for k in keywords]
    combined = "|".join(escaped)
    return [re.compile(combined, re.I)]


def _normalize(text: str) -> str:
    """Lowercase + collapse whitespace for simple comparison."""
    return re.sub(r"\s+", " ", text.lower().strip())


def _extract_sentences(text: str) -> list[str]:
    """Split content into sentences."""
    return [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]


def _find_fear_contradictions(
    content: str,
    fears: dict[str, str],
) -> list[dict[str, Any]]:
    """
    Check if content shows the character doing/saying something
    that directly contradicts their stated fears.
    E.g. character is afraid of fire but casually walks through flames.
    """
    warnings = []

    fear_map = {
        "surface": (fears.get("surface", ""), SEVERITY_HIGH),
        "deep": (fears.get("deep", ""), SEVERITY_HIGH),
        "whatTheyAvoid": (fears.get("whatTheyAvoid", ""), SEVERITY_MEDIUM),
    }

    content_lower = _normalize(content)
    sentences = _extract_sentences(content)

    for fear_field, (fear_text, severity) in fear_map.items():
        if not fear_text:
            continue

        # Check if fear keywords appear in content
        fear_keywords = _build_fear_patterns(fear_text)

        for pat in fear_keywords:
            matches = list(pat.finditer(content))
            if not matches:
                continue

            for m in matches:
                matched_word = m.group(0)
                # Find which sentence this appears in
                for sentence in sentences:
                    if matched_word.lower() in sentence.lower():
                        # Check if this sentence shows the character
                        # deliberately confronting or being unafraid of the fear
                        # Look for: "non ha paura", "attraversa", "senza esitare",
                        # "calmamente", "controlla", etc.
                        unafraid_markers = re.compile(
                            r"\b"
                            r"(senza paura|senza esit|non ha paura|non prova paura|"
                            r"calmante|controlla|governa|dominata?|impavido|intrepido|"
                            r"attraversa|affronta|confronta|incontra.* coraggios"
                            r"| non.* temere | non.* paura)"
                            r"\b",
                            re.I,
                        )
                        if unafraid_markers.search(sentence):
                            warnings.append(
                                {
                                    "rule": "fear_contradiction",
                                    "severity": severity,
                                    "message": (
                                        f"Il contenuto mostra il PG affrontare '{matched_word}' "
                                        f"senza esitazione, ma il profilo indica che questo è "
                                        f"una paura ({fear_field}): {fear_text[:80]}..."
                                    ),
                                    "detail": sentence,
                                    "profile_field": f"fears.{fear_field}",
                                }
                            )

    # Also check inverse: if the character avoids something strongly stated
    # but the content describes them doing it casually
    avoidance_text = fears.get("whatTheyAvoid", "")
    if avoidance_text:
        avoidance_kw = _build_fear_patterns(avoidance_text)
        for pat in avoidance_kw:
            if pat.search(content):
                # The thing they avoid appears — check for casual attitude
                for sentence in sentences:
                    if pat.search(sentence):
                        casual = re.compile(
                            r"\b"
                            r"(entra|esplora|si avvicina|va verso|attraversa|"
                            r"si getta|si lancia|senza paura|volentieri|"
                            r"con sicurezza|senza esitazione)"
                            r"\b",
                            re.I,
                        )
                        if casual.search(sentence):
                            warnings.append(
                                {
                                    "rule": "fear_contradiction",
                                    "severity": SEVERITY_HIGH,
                                    "message": (
                                        f"Il PG sta facendo qualcosa che il suo profilo "
                                        f"indica come evitamento ({fear_field}): '{sentence[:60]}...'"
                                    ),
                                    "detail": sentence,
                                    "profile_field": f"fears.whatTheyAvoid",
                                }
                            )

    return warnings


def _find_backstory_conflicts(
    content: str,
    backstory: str,
    character_name: str,
) -> list[dict[str, Any]]:
    """
    Check if content contradicts key elements of the backstory.
    """
    warnings = []

    if not backstory or not content:
        return warnings

    content_lower = _normalize(content)
    backstory_lower = _normalize(backstory)

    sentences = _extract_sentences(content)

    for (
        description,
        backstory_pat,
        contradiction_pat,
    ) in _BACKSTORY_CONFLICT_PAIRS:
        if backstory_pat.search(backstory):
            # Backstory has this element — check if content contradicts
            if contradiction_pat.search(content_lower):
                # Find the contradicting sentence
                for sentence in sentences:
                    if contradiction_pat.search(sentence):
                        warnings.append(
                            {
                                "rule": "backstory_conflict",
                                "severity": SEVERITY_HIGH,
                                "message": (
                                    f"Possibile contradizione con il backstory: {description}. "
                                    f"Il backstory menziona questo tema."
                                ),
                                "detail": sentence,
                                "profile_field": "backstory",
                            }
                        )
                        break  # One warning per conflict type is enough

    # Check for name-based conflict
    if character_name:
        # If the character has a specific enemy or person from backstory
        # referenced in the content as an ally without explanation
        name_parts = character_name.split()
        if len(name_parts) >= 2:
            last_name = name_parts[-1]
            # Look for "name is..." followed by positive statements
            # without prior narrative setup
            name_ref = re.compile(
                rf"\b{re.escape(last_name)}\b",
                re.I,
            )
            for sentence in sentences:
                if name_ref.search(sentence):
                    # If the sentence says something positive about this person
                    # being an ally but backstory suggests otherwise
                    positive_ally = re.compile(
                        r"\b(alleato|amico|compagno|supporto|alleanza)\b",
                        re.I,
                    )
                    if positive_ally.search(sentence):
                        # Could be a conflict — flag it
                        warnings.append(
                            {
                                "rule": "backstory_conflict",
                                "severity": SEVERITY_MEDIUM,
                                "message": (
                                    f"Riferimento ambiguo a '{last_name}' — "
                                    f"segnalato come alleato ma il profilo potrebbe "
                                    f"contenere elementi conflittuali."
                                ),
                                "detail": sentence,
                                "profile_field": "backstory",
                            }
                        )

    return warnings


def _check_catchphrase_usage(
    content: str,
    catchphrases: list[str],
) -> list[dict[str, Any]]:
    """
    Check if catchphrases are used in wrong contexts or overused.
    """
    warnings = []

    if not catchphrases or not content:
        return warnings

    content_lower = _normalize(content)
    sentences = _extract_sentences(content)

    for cq in catchphrases:
        cq_normalized = _normalize(cq)
        if len(cq_normalized) < 4:
            continue

        # Count occurrences
        count = content_lower.count(cq_normalized)

        if count == 0:
            # Check if a key part of the catchphrase is used
            # but the catchphrase itself is not
            key_words = cq_normalized.split()[:2]
            if key_words:
                key_pattern = re.compile(
                    r"\b" + re.escape(" ".join(key_words)) + r"\b",
                    re.I,
                )
                if key_pattern.search(content_lower):
                    # Key words present but catchphrase not used in full
                    # This could be intentional — no warning needed
                    pass
        elif count >= 3:
            # Overuse
            warnings.append(
                {
                    "rule": "catchphrase_overuse",
                    "severity": SEVERITY_LOW,
                    "message": (
                        f"Il catchphrase '{cq[:40]}...' "
                        f"è stato usato {count} volte nel contenuto — "
                        f"potrebbe risultare artificiale."
                    ),
                    "detail": f"Usato {count} volte",
                    "profile_field": "catchphrases",
                }
            )

    return warnings


def _check_goal_alignment(
    content: str,
    goals_short: str,
    goals_long: str,
) -> list[dict[str, Any]]:
    """
    Check if the character abandons or ignores their stated goals
    without any narrative reason.
    """
    warnings = []

    if not goals_short and not goals_long:
        return warnings

    content_lower = _normalize(content)
    sentences = _extract_sentences(content)

    # Keywords that suggest goal abandonment
    abandonment_markers = re.compile(
        r"\b"
        r"(abbandona|lascia perdere|non mi interessa|non importa|"
        r"cambia idea|dimentica|rinuncia|getta la spugna|"
        r"non è più importante|non mi riguarda|non conta più)"
        r"\b",
        re.I,
    )

    for sentence in sentences:
        if abandonment_markers.search(sentence):
            # Check if there's a short-term goal keyword in the content
            # that might be being abandoned
            if goals_short:
                goal_words = goals_short.lower().split()[:3]
                goal_mentioned = any(
                    w in content_lower for w in goal_words if len(w) > 4
                )
                if goal_mentioned:
                    warnings.append(
                        {
                            "rule": "goal_alignment",
                            "severity": SEVERITY_MEDIUM,
                            "message": (
                                f"Il PG sembra rinunciare a un obiettivo a breve termine "
                                f"senza giustificazione narrativa: '{sentence[:60]}...'"
                            ),
                            "detail": sentence,
                            "profile_field": "goals_short_term",
                        }
                    )

    # Also check if a stated goal is completely ignored in a long session
    if goals_long and len(content.split()) > 200:
        goal_words = goals_long.lower().split()[:4]
        mentioned = any(w in content_lower for w in goal_words if len(w) > 5)
        if not mentioned:
            warnings.append(
                {
                    "rule": "goal_alignment",
                    "severity": SEVERITY_LOW,
                    "message": (
                        "Il contenuto non menziona nessun elemento "
                        "collegato agli obiettivi a lungo termine del PG."
                    ),
                    "detail": f"Obiettivo LT: {goals_long[:80]}...",
                    "profile_field": "goals_long_term",
                }
            )

    return warnings


def _check_motivation_contradiction(
    content: str,
    motivations: dict[str, str],
) -> list[dict[str, Any]]:
    """
    Check if actions contradict stated motivations.
    E.g. character is motivated by justice but does something unjust.
    """
    warnings = []

    if not motivations:
        return warnings

    motivation_map = {
        "primary": (motivations.get("primary", ""), SEVERITY_HIGH),
        "secondary": (motivations.get("secondary", ""), SEVERITY_MEDIUM),
        "unconscious": (motivations.get("unconscious", ""), SEVERITY_LOW),
    }

    sentences = _extract_sentences(content)

    for field, (motivation_text, severity) in motivation_map.items():
        if not motivation_text:
            continue

        mot_lower = _normalize(motivation_text)

        # Detect motivation type
        if any(
            kw in mot_lower
            for kw in ["giustiz", "vendetta", "onore", "dovere", "correttezza"]
        ):
            # Justice/honor motivation
            unjust_patterns = [
                re.compile(
                    r"\b"
                    r"(tradisce|mentre|imbroglia|ruba|assassina|incolpa.* innocente|"
                    r"corrompe|ricatta|minaccia|estorce|opprime|schiavizz)"
                    r"\b",
                    re.I,
                )
            ]
            for sentence in sentences:
                for pat in unjust_patterns:
                    if pat.search(sentence):
                        warnings.append(
                            {
                                "rule": "motivation_contradiction",
                                "severity": severity,
                                "message": (
                                    f"Il contenuto mostra un'azione ingiusta, "
                                    f"ma la motivazione primaria del PG è la giustizia: "
                                    f"'{sentence[:60]}...'"
                                ),
                                "detail": sentence,
                                "profile_field": f"motivations.{field}",
                            }
                        )

        if any(kw in mot_lower for kw in ["lealt", "fiducia", "amicizia", "compagno"]):
            # Loyalty motivation
            disloyal_patterns = [
                re.compile(
                    r"\b"
                    r"(tradisce|abbandona|lascia indietro|mente.* amic|"
                    r"si volta.* spalle|scarica|ignora.* alleati)"
                    r"\b",
                    re.I,
                )
            ]
            for sentence in sentences:
                for pat in disloyal_patterns:
                    if pat.search(sentence):
                        warnings.append(
                            {
                                "rule": "motivation_contradiction",
                                "severity": severity,
                                "message": (
                                    f"Il contenuto mostra dislealtà, "
                                    f"ma la motivazione del PG include lealtà/amicizia: "
                                    f"'{sentence[:60]}...'"
                                ),
                                "detail": sentence,
                                "profile_field": f"motivations.{field}",
                            }
                        )

        if any(kw in mot_lower for kw in ["conoscenza", "sapere", "verità", "mistero", "arcano"]):
            # Knowledge motivation
            ignore_truth = re.compile(
                r"\b"
                r"(ignora.* verità|non vuole sapere|blocca.* indagine|"
                r"nasconde.* prova|evita.* verità|accetta.* bugia)"
                r"\b",
                re.I,
            )
            for sentence in sentences:
                if ignore_truth.search(sentence):
                    warnings.append(
                        {
                            "rule": "motivation_contradiction",
                            "severity": severity,
                            "message": (
                                f"Il PG sembra ignorare la verità/conoscenza "
                                f"nonostante la sua motivazione: '{sentence[:60]}...'"
                            ),
                            "detail": sentence,
                            "profile_field": f"motivations.{field}",
                        }
                    )

    return warnings


def check_consistency(
    character: dict[str, Any],
    content: str,
) -> dict[str, Any]:
    """
    Main entry point. Runs all consistency checks.
    Returns {"ok": bool, "warnings": [...]}.
    """
    warnings: list[dict[str, Any]] = []

    if not content or not content.strip():
        return {"ok": True, "warnings": []}

    # 1. Fear contradictions
    fears = character.get("fears", {}) or {}
    warnings.extend(_find_fear_contradictions(content, fears))

    # 2. Backstory conflicts
    backstory = character.get("backstory", "") or ""
    name = character.get("name", "") or ""
    warnings.extend(_find_backstory_conflicts(content, backstory, name))

    # 3. Catchphrase usage
    catchphrases = character.get("catchphrases", []) or []
    warnings.extend(_check_catchphrase_usage(content, catchphrases))

    # 4. Goal alignment
    goals_short = character.get("goals_short_term", "") or ""
    goals_long = character.get("goals_long_term", "") or ""
    warnings.extend(_check_goal_alignment(content, goals_short, goals_long))

    # 5. Motivation contradictions
    motivations = character.get("motivations", {}) or {}
    warnings.extend(_check_motivation_contradiction(content, motivations))

    # Deduplicate warnings by rule + profile_field + first 40 chars of detail
    seen: set[tuple] = set()
    unique: list[dict[str, Any]] = []
    for w in warnings:
        key = (w["rule"], w.get("profile_field", ""), w.get("detail", "")[:40])
        if key not in seen:
            seen.add(key)
            unique.append(w)

    return {
        "ok": len(unique) == 0,
        "warnings": unique,
    }


def main() -> None:
    """Read input from stdin, write output to stdout."""
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            result = {"ok": True, "warnings": []}
        else:
            payload = json.loads(raw)
            character = payload.get("character", {})
            content = payload.get("content", "")
            result = check_consistency(character, content)
        sys.stdout.write(json.dumps(result, ensure_ascii=False))
    except json.JSONDecodeError as e:
        sys.stderr.write(f"JSON decode error: {e}\n")
        sys.exit(1)
    except Exception as e:
        sys.stderr.write(f"Unexpected error: {e}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
