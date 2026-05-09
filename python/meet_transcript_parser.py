"""Transcript parser — extracts structured records from meet_bot transcript.txt.

Each line in the transcript file has the format ``[HH:MM:SS] Speaker: text``.
This module parses that format into a list of dicts with typed fields, suitable
for downstream consumers (key moment detector, session storage, UI display).

Example::

    from meet_parser import parse_transcript, parse_line

    records = parse_transcript(Path("/tmp/meet-debug/transcript.txt"))
    for r in records:
        print(f"{r['timestamp']} {r['speaker']}: {r['text']}")
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import time as dt_time
from pathlib import Path
from typing import Optional


# -----------------------------------------------------------------------------
# Data model
# -----------------------------------------------------------------------------

@dataclass
class TranscriptRecord:
    """Single parsed caption line."""
    timestamp: dt_time          # naive time from [HH:MM:SS]
    raw: str                    # original line as-is
    speaker: str                # display name or "Unknown"
    text: str                   # stripped text content
    seconds: int = field(init=False)  # seconds since midnight

    def __post_init__(self):
        self.seconds = (
            self.timestamp.hour * 3600
            + self.timestamp.minute * 60
            + self.timestamp.second
        )


# -----------------------------------------------------------------------------
# Regex-based line parser
# -----------------------------------------------------------------------------

# Pattern: [HH:MM:SS] Speaker Name: text content
# We allow the speaker name to contain unicode, spaces, and common punctuation
# but exclude the colon (which separates speaker from text).
_LINE_RE = re.compile(
    r"^\[(\d{2}:\d{2}:\d{2})\]\s+"
    r"([^:]*):"   # speaker name (may be empty)
    r"(.*)$",     # text (may be empty — \s* allows bare ":" lines)
    re.UNICODE,
)


def parse_line(line: str) -> Optional[TranscriptRecord]:
    """Parse a single transcript line into a TranscriptRecord, or return None.

    ``line`` should be a raw line stripped of its trailing newline.
    Returns None if the line doesn't match the expected format.
    """
    m = _LINE_RE.match(line)
    if not m:
        return None
    ts_str, speaker, text = m.group(1), m.group(2), m.group(3)
    try:
        hh, mm, ss = (int(x) for x in ts_str.split(":"))
        timestamp = dt_time(hh, mm, ss)
    except ValueError:
        return None
    # Empty speaker → Unknown, empty text is allowed (blank caption lines)
    return TranscriptRecord(
        timestamp=timestamp,
        raw=line,
        speaker=(speaker or "").strip() or "Unknown",
        text=(text or "").strip(),
    )


# -----------------------------------------------------------------------------
# File-level parser
# -----------------------------------------------------------------------------

def parse_transcript(
    path: Path | str,
    *,
    max_lines: Optional[int] = None,
) -> list[TranscriptRecord]:
    """Parse a transcript file and return a list of TranscriptRecords.

    Args:
        path: Path to the ``transcript.txt`` file written by meet_bot.
        max_lines: If given, only read the last N lines (like Unix ``tail``).
                   Useful for polling during a live meeting.

    Returns:
        List of TranscriptRecord in the order they appear in the file.
        Empty list if the file doesn't exist or no lines parse successfully.

    Note:
        The parser is tolerant — a line that fails to parse is silently
        skipped rather than raising. This is intentional because Google
        Meet occasionally emits non-standard caption fragments.
    """
    p = Path(path)
    if not p.is_file():
        return []

    if max_lines is not None:
        # Read last N lines efficiently — works for any line ending.
        with p.open("rb") as fh:
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
    """Return the last n lines of an already-opened file handle.

    Memory-efficient for very large transcript files — seeks from end
    rather than reading the whole file.
    """
    # Ensure we can seek from end.
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
        buf.extend(chunk)  # append; we read in reverse so final list is right-order
        cr_count = chunk.count(b"\n") + chunk.count(b"\r")
        remaining -= cr_count

    # Decode and split.
    text = buf.decode("utf-8", errors="replace")
    all_lines = text.splitlines()
    # Drop any partial first line (incomplete newline at file boundary).
    if all_lines and not all_lines[0].endswith(("\n", "\r")):
        all_lines = all_lines[1:]
    return all_lines[-n:]


# -----------------------------------------------------------------------------
# Convenience helpers
# -----------------------------------------------------------------------------

def format_duration(seconds: int) -> str:
    """Format a second count as ``HH:MM:SS``."""
    hh, rem = divmod(seconds, 3600)
    mm, ss = divmod(rem, 60)
    return f"{hh:02d}:{mm:02d}:{ss:02d}"


def get_speaker_stats(
    records: list[TranscriptRecord],
) -> dict[str, dict[str, int]]:
    """Return per-speaker statistics from a list of records.

    Returns a dict mapping speaker name → {
        "utterances": count of lines,
        "words": total word count,
        "first_seen_at": seconds since midnight,
        "last_seen_at": seconds since midnight,
    }
    """
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