"""Key moment detector — analyses parsed transcript for important events.

Key moments are classified into these categories:
  - question        : someone asked something important
  - decision         : a decision was made or agreed
  - action_item      : someone volunteered or was assigned an action
  - important_point  : a significant statement or revelation
  - topic_change     : subject switched (logged for navigation)

The detector is rule-based (pattern matching) for low latency and zero
dependency cost. It is designed to run after every polling tick so the
user can ask "what are the key moments so far?" at any point.

If you need LLM-quality analysis, pass the records to
``detect_with_llm()`` which calls out to the active agent's chat completion
endpoint (when one is configured).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import time as dt_time
from enum import Enum
from pathlib import Path
from typing import Optional

from meet_transcript_parser import TranscriptRecord, parse_transcript


# -----------------------------------------------------------------------------
# Data model
# -----------------------------------------------------------------------------

class MomentKind(Enum):
    QUESTION       = "question"
    DECISION       = "decision"
    ACTION_ITEM    = "action_item"
    IMPORTANT_POINT = "important_point"
    TOPIC_CHANGE   = "topic_change"


@dataclass
class KeyMoment:
    """A detected key moment in a meeting transcript."""
    kind: MomentKind
    speaker: str
    timestamp: dt_time
    seconds: int
    text: str
    summary: str                    # short one-line description
    confidence: float = 1.0         # 0.0–1.0; rule-based detectors are ~0.7–0.9
    triggered_on: str = field(default="")  # pattern or rule name that fired


# -----------------------------------------------------------------------------
# Pattern sets
# -----------------------------------------------------------------------------

# Action item patterns — must appear BEFORE any negation logic.
_ACTION_PATTERNS = [
    re.compile(r"\b(i'll|i will|i'm going to|i shall|let's|let\'s)\s+\w+", re.I),
    re.compile(r"\b(please|pls|plz|could you|would you|can you)\s+\w+", re.I),
    re.compile(r"\b(todo|tbd|need to|should|ought to|must|has to|have to)\s+\w+", re.I),
    re.compile(r"\b(assign|delegate|follow[- ]?up|action\b)", re.I),
]

# Decision patterns — strong agreement / commitment language.
_DECISION_PATTERNS = [
    re.compile(r"\b(decided|agreed|confirmed|concluded|resolved|settled|final\b)", re.I),
    re.compile(r"\b(yes|yeah|yep|exactly|that's (it|right|the plan))\b", re.I),
    re.compile(r"\b(we(?:'ll| will) (do|go with|use|build|implement|ship))\b", re.I),
    re.compile(r"\b(approved|green[- ]?light|signed off|go ahead)\b", re.I),
]

# Question patterns.
_QUESTION_PATTERNS = [
    re.compile(r"\?"),
    re.compile(r"\b(what if|how do|why (don't|does|is)|can we|should we|who (does|will|can)|where (do|does|is)|when (do|does|will))\b", re.I),
]

# Important-point patterns — superlatives, commitments, revelations.
_IMPORTANT_PATTERNS = [
    re.compile(r"\b(important|critical|key|essential|must[- ]?know|keep in mind|remember|note\b)", re.I),
    re.compile(r"\b(new|updated|changed|broken|failed|launched|released|deprecated)\b", re.I),
    re.compile(r"\b(\d+%|increase|decrease|growth|drop|rise|up|down|record|high|low|best|worst)\b", re.I),
    re.compile(r"\b(because|since|reason is|means that|therefore|so|as a result)\b", re.I),
    re.compile(r"\b(actually|honestly|realistically|the truth is|frankly)\b", re.I),
]

# Topic-change markers.
_TOPIC_CHANGE_PATTERNS = [
    re.compile(r"\b(let'?s? (move|go|start)|back to|switching|regarding|moving)\b", re.I),
    re.compile(r"^\s*(\[?\d{1,2}:\d{2}(:\d{2})?\]?\s*)?(topic|agenda|subject)\s*:", re.I),
]


# -----------------------------------------------------------------------------
# Single-record scorer
# -----------------------------------------------------------------------------

def _score_record(
    rec: TranscriptRecord,
) -> list[KeyMoment]:
    """Return a list of KeyMoments detected in a single transcript record.

    A record can produce zero, one, or multiple moments (e.g. a line that
    is both a question AND contains an action item).
    """
    moments: list[KeyMoment] = []
    text = rec.text
    lowered = text.lower()

    # --- Action item ---------------------------------------------------
    for pat in _ACTION_PATTERNS:
        if pat.search(text):
            moments.append(KeyMoment(
                kind=MomentKind.ACTION_ITEM,
                speaker=rec.speaker,
                timestamp=rec.timestamp,
                seconds=rec.seconds,
                text=text,
                summary=_summarise(text),
                confidence=0.8,
                triggered_on=pat.pattern,
            ))
            break   # one trigger per category is enough

    # --- Decision -------------------------------------------------------
    for pat in _DECISION_PATTERNS:
        if pat.search(text):
            moments.append(KeyMoment(
                kind=MomentKind.DECISION,
                speaker=rec.speaker,
                timestamp=rec.timestamp,
                seconds=rec.seconds,
                text=text,
                summary=_summarise(text),
                confidence=0.85,
                triggered_on=pat.pattern,
            ))
            break

    # --- Question -------------------------------------------------------
    for pat in _QUESTION_PATTERNS:
        if pat.search(text):
            moments.append(KeyMoment(
                kind=MomentKind.QUESTION,
                speaker=rec.speaker,
                timestamp=rec.timestamp,
                seconds=rec.seconds,
                text=text,
                summary=_summarise(text),
                confidence=0.9,
                triggered_on=pat.pattern,
            ))
            break

    # --- Important point ------------------------------------------------
    for pat in _IMPORTANT_PATTERNS:
        if pat.search(text):
            moments.append(KeyMoment(
                kind=MomentKind.IMPORTANT_POINT,
                speaker=rec.speaker,
                timestamp=rec.timestamp,
                seconds=rec.seconds,
                text=text,
                summary=_summarise(text),
                confidence=0.75,
                triggered_on=pat.pattern,
            ))
            break

    # --- Topic change ---------------------------------------------------
    for pat in _TOPIC_CHANGE_PATTERNS:
        if pat.search(text):
            moments.append(KeyMoment(
                kind=MomentKind.TOPIC_CHANGE,
                speaker=rec.speaker,
                timestamp=rec.timestamp,
                seconds=rec.seconds,
                text=text,
                summary=_summarise(text),
                confidence=0.9,
                triggered_on=pat.pattern,
            ))
            break

    return moments


def _summarise(text: str, max_len: int = 80) -> str:
    """Short one-line summary of a transcript line."""
    # Strip filler words at start.
    text = re.sub(r"^(um|uh|like|you know|basically|actually|so |well ),", r"", text, flags=re.I)
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip(" ,.") + "…"


# -----------------------------------------------------------------------------
# Top-level API
# -----------------------------------------------------------------------------

def detect_moments(
    records: list[TranscriptRecord],
    *,
    min_confidence: float = 0.7,
) -> list[KeyMoment]:
    """Detect key moments from a list of parsed TranscriptRecords.

    Args:
        records: Output of ``parse_transcript()``.
        min_confidence: Minimum confidence threshold (0.0–1.0). Lower-confidence
                        moments are dropped. Default 0.7.

    Returns:
        Chronologically ordered list of KeyMoment objects.
        Zero moments is a valid result — the meeting may not have produced
        any detectable key moments yet.
    """
    moments: list[KeyMoment] = []
    for rec in records:
        moments.extend(_score_record(rec))

    # Deduplicate by (kind, speaker, timestamp, text) to avoid double-counting
    # when a line matched multiple patterns in the same category.
    seen: set[tuple] = set()
    out: list[KeyMoment] = []
    for m in moments:
        key = (m.kind, m.speaker, m.seconds, m.text)
        if key not in seen and m.confidence >= min_confidence:
            seen.add(key)
            out.append(m)

    return out


# Convenience: detect from a transcript file path.
def detect_from_file(
    path: Path | str,
    *,
    min_confidence: float = 0.7,
    max_records: Optional[int] = None,
) -> list[KeyMoment]:
    """Parse *path* and run key-moment detection on it.

    Passes through to ``parse_transcript`` and ``detect_moments``.
    """
    records = parse_transcript(path, max_lines=max_records)
    return detect_moments(records, min_confidence=min_confidence)


# -----------------------------------------------------------------------------
# Optional LLM-based detection
# -----------------------------------------------------------------------------

# Kept as a stub so callers can swap in LLM analysis without changing signatures.
def detect_with_llm(
    records: list[TranscriptRecord],
    *,
    llm_callable: Optional[callable] = None,
    min_confidence: float = 0.6,
) -> list[KeyMoment]:
    """Run key-moment detection using an LLM instead of rules.

    Args:
        records: Transcript records to analyse.
        llm_callable: A callable that accepts a single string prompt and
                      returns a JSON-encoded list of moments. If None,
                      falls back to rule-based detection.
        min_confidence: Passed through for the fallback path.

    Returns:
        LLM-detected moments (or rule-based fallback if llm_callable is None).

    Note:
        This is a stub. To enable it, pass a real LLM client, e.g.::

            def my_llm(prompt: str) -> str:
                return openai.chat.completions.create(
                    model="gpt-4o", messages=[{"role":"user","content":prompt}]
                ).choices[0].message.content

            moments = detect_with_llm(records, llm_callable=my_llm)
    """
    if llm_callable is None:
        return detect_moments(records, min_confidence=min_confidence)

    # Format transcript for LLM consumption.
    lines = "\n".join(
        f"[{_fmt_time(r.timestamp)}] {r.speaker}: {r.text}"
        for r in records
    )
    prompt = (
        "You are a meeting analyst. Given the transcript below, identify all key "
        "moments and return a JSON list of objects with fields: "
        "kind (question|decision|action_item|important_point), speaker, "
        "timestamp (HH:MM:SS), text, summary, confidence (0.0-1.0).\n\n"
        f"{lines}"
    )
    try:
        raw = llm_callable(prompt)
        # Assume the LLM returns a JSON list — parse it.
        import json
        data = json.loads(raw) if isinstance(raw, str) else raw
        moments = []
        for item in data:
            ts = _parse_time(item.get("timestamp", "00:00:00"))
            sec = ts.hour * 3600 + ts.minute * 60 + ts.second if ts else 0
            moments.append(KeyMoment(
                kind=MomentKind(item.get("kind", "important_point")),
                speaker=item.get("speaker", "Unknown"),
                timestamp=ts or dt_time(0, 0, 0),
                seconds=sec,
                text=item.get("text", ""),
                summary=item.get("summary", ""),
                confidence=float(item.get("confidence", 0.8)),
            ))
        return moments
    except Exception:
        # Fallback to rules on any LLM error.
        return detect_moments(records, min_confidence=min_confidence)


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

def _fmt_time(t: dt_time) -> str:
    return f"{t.hour:02d}:{t.minute:02d}:{t.second:02d}"


def _parse_time(s: str) -> Optional[dt_time]:
    try:
        parts = s.strip().split(":")
        if len(parts) == 3:
            return dt_time(int(parts[0]), int(parts[1]), int(parts[2]))
        if len(parts) == 2:
            return dt_time(0, int(parts[0]), int(parts[1]))
    except (ValueError, TypeError):
        pass
    return None


# -----------------------------------------------------------------------------
# Formatting helpers for UI / export
# -----------------------------------------------------------------------------

def format_moments_as_text(
    moments: list[KeyMoment],
    *,
    show_confidence: bool = False,
) -> str:
    """Render a list of key moments as a human-readable plain-text summary.

    Useful for pasting into a recap message or document.
    """
    if not moments:
        return "No key moments detected yet."

    lines = ["Key Moments\n" + "=" * 50]
    for m in moments:
        icon = {
            MomentKind.QUESTION:        "❓",
            MomentKind.DECISION:        "✅",
            MomentKind.ACTION_ITEM:    "📋",
            MomentKind.IMPORTANT_POINT: "💡",
            MomentKind.TOPIC_CHANGE:   "🔀",
        }.get(m.kind, "•")
        conf_str = f" [{m.confidence:.0%}]" if show_confidence else ""
        lines.append(f"{icon} [{_fmt_time(m.timestamp)}] {m.speaker}: {m.summary}{conf_str}")
        lines.append(f"   {m.text}")
        lines.append("")
    return "\n".join(lines)


def group_moments_by_kind(
    moments: list[KeyMoment],
) -> dict[MomentKind, list[KeyMoment]]:
    """Partition moments by their kind."""
    out: dict[MomentKind, list[KeyMoment]] = {k: [] for k in MomentKind}
    for m in moments:
        out[m.kind].append(m)
    return out