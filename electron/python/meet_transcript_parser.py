"""
meet_transcript_parser — Electron shim.
Parses [HH:MM:SS] Speaker: text lines from Google Meet transcript files.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import time as dt_time
from pathlib import Path
from typing import Optional


@dataclass
class TranscriptRecord:
    timestamp: dt_time
    raw: str
    speaker: str
    text: str
    seconds: int = field(init=False)

    def __post_init__(self):
        self.seconds = (
            self.timestamp.hour * 3600
            + self.timestamp.minute * 60
            + self.timestamp.second
        )


_LINE_RE = re.compile(
    r"^\[(\d{2}:\d{2}:\d{2})]\s+"
    r"([^:]*):"
    r"(.*)$",
    re.UNICODE,
)


def parse_line(line: str) -> Optional[TranscriptRecord]:
    m = _LINE_RE.match(line)
    if not m:
        return None
    ts_str, speaker, text = m.group(1), m.group(2), m.group(3)
    try:
        hh, mm, ss = (int(x) for x in ts_str.split(":"))
        timestamp = dt_time(hh, mm, ss)
    except ValueError:
        return None
    return TranscriptRecord(
        timestamp=timestamp,
        raw=line,
        speaker=(speaker or "").strip() or "Unknown",
        text=(text or "").strip(),
    )


def parse_transcript(
    path: Path | str,
    *,
    max_lines: Optional[int] = None,
) -> list[TranscriptRecord]:
    p = Path(path)
    if not p.is_file():
        return []

    if max_lines is not None:
        with p.open("r", encoding="utf-8", errors="replace") as fh:
            lines = _tail_lines(fh, max_lines)
    else:
        with p.open("r", encoding="utf-8", errors="replace") as fh:
            lines = [ln.rstrip("\n\r") for ln in fh]

    records: list[TranscriptRecord] = []
    for ln in lines:
        rec = parse_line(ln)
        if rec is not None and rec.text:
            records.append(rec)
    return records


def _tail_lines(fh, n: int) -> list[str]:
    fh.seek(0, 2)
    file_size = fh.tell()
    if file_size == 0:
        return []

    remaining = n
    buf = bytearray()
    pos = file_size

    while remaining > 0 and pos > 0:
        step = min(8192, pos)
        pos -= step
        fh.seek(pos)
        chunk = fh.read(step)
        buf[:0] = chunk
        cr_count = chunk.count(b"\n") + chunk.count(b"\r")
        remaining -= cr_count

    text = buf.decode("utf-8", errors="replace")
    all_lines = text.splitlines()
    if all_lines and not all_lines[0].endswith(("\n", "\r")):
        all_lines = all_lines[1:]
    return all_lines[-n:]


def format_duration(seconds: int) -> str:
    hh, rem = divmod(seconds, 3600)
    mm, ss = divmod(rem, 60)
    return f"{hh:02d}:{mm:02d}:{ss:02d}"


def get_speaker_stats(
    records: list[TranscriptRecord],
) -> dict[str, dict[str, int]]:
    stats: dict[str, dict] = {}
    for rec in records:
        if rec.speaker not in stats:
            stats[rec.speaker] = {
                "utterances": 0,
                "words": 0,
                "first_seen_at": rec.seconds,
                "last_seen_at": rec.seconds,
            }
        s = stats[rec.speaker]
        s["utterances"] += 1
        s["words"] += len(rec.text.split())
        s["last_seen_at"] = max(s["last_seen_at"], rec.seconds)
    return stats
