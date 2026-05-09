"""
meet_key_moments — Electron shim.
Rule-based key moment detector for Google Meet transcripts.
Detects: question, decision, action_item, important_point, topic_change.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import time as dt_time
from enum import Enum
from pathlib import Path
from typing import Optional

from meet_transcript_parser import TranscriptRecord, parse_transcript


class MomentKind(Enum):
    QUESTION = "question"
    DECISION = "decision"
    ACTION_ITEM = "action_item"
    IMPORTANT_POINT = "important_point"
    TOPIC_CHANGE = "topic_change"


@dataclass
class KeyMoment:
    kind: MomentKind
    speaker: str
    timestamp: dt_time
    seconds: int
    text: str
    summary: str
    confidence: float = 1.0
    triggered_on: str = ""


_ACTION_PATTERNS = [
    re.compile(r"\b(i'll|i will|i'm going to|i shall|let's|let\'s)\s+\w+", re.I),
    re.compile(r"\b(please|pls|plz|could you|would you|can you)\s+\w+", re.I),
    re.compile(r"\b(todo|tbd|need to|should|ought to|must|has to|have to)\s+\w+", re.I),
    re.compile(r"\b(assign|delegate|follow[- ]?up|action\b)", re.I),
]

_DECISION_PATTERNS = [
    re.compile(r"\b(decided|agreed|confirmed|concluded|resolved|settled|final\b)", re.I),
    re.compile(r"\b(yes|yeah|yep|exactly|that's (it|right|the plan))\b", re.I),
    re.compile(r"\b(we(?:'ll| will) (do|go with|use|build|implement|ship))\b", re.I),
    re.compile(r"\b(approved|green[- ]?light|signed off|go ahead)\b", re.I),
]

_QUESTION_PATTERNS = [
    re.compile(r"\?"),
    re.compile(r"\b(what if|how do|why (don't|does|is)|can we|should we|who (does|will|can)|where (do|does|is)|when (do|does|will))\b", re.I),
]

_IMPORTANT_PATTERNS = [
    re.compile(r"\b(important|critical|key|essential|must[- ]?know|keep in mind|remember|note\b)", re.I),
    re.compile(r"\b(new|updated|changed|broken|failed|launched|released|deprecated)\b", re.I),
    re.compile(r"\b(\d+%|increase|decrease|growth|drop|rise|up|down|record|high|low|best|worst)\b", re.I),
    re.compile(r"\b(because|since|reason is|means that|therefore|so|as a result)\b", re.I),
    re.compile(r"\b(actually|honestly|realistically|the truth is|frankly)\b", re.I),
]

_TOPIC_CHANGE_PATTERNS = [
    re.compile(r"\b(let'?s? (move|go|start)|back to|switching|regarding|moving)\b", re.I),
    re.compile(r"^\s*(\[?\d{1,2}:\d{2}(:\d{2})?\]?\s*)?(topic|agenda|subject)\s*:", re.I),
]


def _score_record(rec: TranscriptRecord) -> list[KeyMoment]:
    moments: list[KeyMoment] = []
    text = rec.text

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
            break

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
    text = re.sub(r"^(um|uh|like|you know|basically|actually|so |well ),", r"", text, flags=re.I)
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip(" ,.") + "…"


def detect_moments(
    records: list[TranscriptRecord],
    *,
    min_confidence: float = 0.7,
) -> list[KeyMoment]:
    moments: list[KeyMoment] = []
    for rec in records:
        moments.extend(_score_record(rec))

    seen: set[tuple] = set()
    out: list[KeyMoment] = []
    for m in moments:
        key = (m.kind, m.speaker, m.seconds, m.text)
        if key not in seen and m.confidence >= min_confidence:
            seen.add(key)
            out.append(m)

    return out


def detect_from_file(
    path: Path | str,
    *,
    min_confidence: float = 0.7,
    max_records: Optional[int] = None,
) -> list[KeyMoment]:
    records = parse_transcript(path, max_lines=max_records)
    return detect_moments(records, min_confidence=min_confidence)


def detect_with_llm(
    records: list[TranscriptRecord],
    *,
    llm_callable: Optional[callable] = None,
    min_confidence: float = 0.6,
) -> list[KeyMoment]:
    if llm_callable is None:
        return detect_moments(records, min_confidence=min_confidence)

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
        return detect_moments(records, min_confidence=min_confidence)


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


def format_moments_as_text(
    moments: list[KeyMoment],
    *,
    show_confidence: bool = False,
) -> str:
    if not moments:
        return "No key moments detected yet."

    lines = ["Key Moments\n" + "=" * 50]
    for m in moments:
        icon = {
            MomentKind.QUESTION: "❓",
            MomentKind.DECISION: "✅",
            MomentKind.ACTION_ITEM: "📋",
            MomentKind.IMPORTANT_POINT: "💡",
            MomentKind.TOPIC_CHANGE: "🔀",
        }.get(m.kind, "•")
        conf_str = f" [{m.confidence:.0%}]" if show_confidence else ""
        lines.append(f"{icon} [{_fmt_time(m.timestamp)}] {m.speaker}: {m.summary}{conf_str}")
        lines.append(f"   {m.text}")
        lines.append("")
    return "\n".join(lines)


def group_moments_by_kind(
    moments: list[KeyMoment],
) -> dict[MomentKind, list[KeyMoment]]:
    out: dict[MomentKind, list[KeyMoment]] = {k: [] for k in MomentKind}
    for m in moments:
        out[m.kind].append(m)
    return out
