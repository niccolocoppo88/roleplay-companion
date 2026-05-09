"""
Real-time suggestion engine — polls transcript and generates PG suggestions.

Architecture:
  1. Poll the live transcript file on a configurable interval.
  2. Diff new lines against the last-seen position to get recent transcript.
  3. Feed recent transcript to MiniMax via build_realtime_suggestion_prompt().
  4. Parse the response; if MOMENTO_CHIAVE, emit a SuggestionEvent.
  5. Expose start() / stop() / is_running() for IPC-driven lifecycle.

The engine is completely LLM-agnostic — pass any callable(prompt: str) -> str
at construction time. A stub is provided so the module can be imported and
unit-tested without a live MiniMax connection.
"""

from __future__ import annotations

import json
import re
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Callable, Optional

from generators.prompts import (
    CharacterContext,
    build_realtime_suggestion_prompt,
)


# -----------------------------------------------------------------------------
# Data model
# -----------------------------------------------------------------------------

class SuggestionPriority(Enum):
    HIGH   = "high"
    MEDIUM = "medium"
    LOW    = "low"


class MomentType(Enum):
    DECISION        = "decision"
    COMBATTIMENTO   = "combattimento"
    INTERAZIONE_NPC  = "interazione_npc"
    OPPORTUNITA      = "opportunità"
    TENSIONE         = "tensione"


@dataclass
class SuggestionEvent:
    """Emitted whenever the engine detects a relevant moment."""
    timestamp:      str          # "HH:MM:SS"
    seconds:        int          # seconds since midnight
    priority:       SuggestionPriority
    moment_type:    MomentType
    suggestion_text: str          # what the PG would do/say
    context:        str          # why this moment matters
    raw_response:   str          # full LLM raw text


# -----------------------------------------------------------------------------
# Response parser
# -----------------------------------------------------------------------------

_RE_MOMENTO_CHIAVE = re.compile(
    r"MOMENTO_CHIAVE\s*\n"
    r"Tipo:\s*(?P<tipo>\w+)\s*\n"
    r"Priorità:\s*(?P<priorità>high|medium|low)\s*\n"
    r"(?P<testo>.*?)\n"
    r"Contesto:\s*(?P<contesto>.*)",
    re.DOTALL | re.IGNORECASE,
)

_RE_SUGGESTION_LINE = re.compile(r"^\d{2}:\d{2}:\d{2}", re.IGNORECASE)


def _parse_llm_response(raw: str) -> Optional[SuggestionEvent]:
    """Parse MiniMax response text into a SuggestionEvent, or return None."""
    # Guard: NESSUN_MOMENTO means no relevant moment.
    if "NESSUN_MOMENTO" in raw:
        return None

    m = _RE_MOMENTO_CHIAVE.search(raw)
    if not m:
        return None

    tipo_str    = m.group("tipo").strip().lower()
    priority_str = m.group("priorità").strip().lower()
    suggestion   = m.group("testo").strip()
    context      = m.group("contesto").strip()

    # MapTipo string -> MomentType
    tipo_map = {
        "decision":          MomentType.DECISION,
        "combattimento":     MomentType.COMBATTIMENTO,
        "interazione_npc":   MomentType.INTERAZIONE_NPC,
        "opportunità":       MomentType.OPPORTUNITA,
        "tensione":          MomentType.TENSIONE,
    }
    # Map priority string -> SuggestionPriority
    priority_map = {
        "high":   SuggestionPriority.HIGH,
        "medium": SuggestionPriority.MEDIUM,
        "low":    SuggestionPriority.LOW,
    }

    moment_type = tipo_map.get(tipo_str, MomentType.DECISION)
    priority    = priority_map.get(priority_str, SuggestionPriority.MEDIUM)

    # Extract timestamp from the suggestion text if present
    ts_match = _RE_SUGGESTION_LINE.search(suggestion)
    if ts_match:
        ts_str = ts_match.group(0).strip("[] ")
        # Convert to seconds
        parts = ts_str.split(":")
        if len(parts) == 3:
            seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
            # Remove timestamp from suggestion text
            suggestion = _RE_SUGGESTION_LINE.sub("", suggestion).strip()
        else:
            seconds = 0
    else:
        ts_str   = "00:00:00"
        seconds  = 0

    return SuggestionEvent(
        timestamp=ts_str,
        seconds=seconds,
        priority=priority,
        moment_type=moment_type,
        suggestion_text=suggestion,
        context=context,
        raw_response=raw,
    )


# -----------------------------------------------------------------------------
# Stub LLM — used when no real LLM is configured
# -----------------------------------------------------------------------------

def _stub_llm(prompt: str) -> str:
    """No-op LLM stub that always returns NESSUN_MOMENTO."""
    return "NESSUN_MOMENTO"


# -----------------------------------------------------------------------------
# Main engine
# -----------------------------------------------------------------------------

class SuggestionEngine:
    """Real-time suggestion engine with polling loop."""

    def __init__(
        self,
        *,
        llm_callable:   Callable[[str], str] | None = None,
        poll_interval:  float = 10.0,        # seconds between transcript checks
        transcript_path: str | Path | None = None,
        character:      CharacterContext | None = None,
        session_context: str = "",
        min_priority:   SuggestionPriority = SuggestionPriority.MEDIUM,
    ):
        self._llm          = llm_callable or _stub_llm
        self._poll_interval = poll_interval
        self._transcript_path = Path(transcript_path) if transcript_path else None
        self._character     = character
        self._session_context = session_context
        self._min_priority  = min_priority

        self._running    = False
        self._stop_event = threading.Event()
        self._thread:   threading.Thread | None = None
        self._last_pos   = 0          # byte offset in transcript file
        self._last_ts    = 0.0        # timestamp of last poll

        # Callbacks for consumers (IPC layer, Telegram, etc.)
        self._callbacks: list[Callable[[SuggestionEvent], None]] = []

    # ── Public API ─────────────────────────────────────────────────────────

    def start(self) -> None:
        """Start the polling loop in a background thread."""
        if self._running:
            return
        self._running    = True
        self._stop_event.clear()
        self._thread     = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """Signal the polling loop to stop and wait for it to exit."""
        if not self._running:
            return
        self._running = False
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=15.0)
            self._thread = None

    def is_running(self) -> bool:
        return self._running

    def update_character(self, character: CharacterContext) -> None:
        """Swap the active character at runtime."""
        self._character = character

    def update_session_context(self, context: str) -> None:
        self._session_context = context

    def update_transcript_path(self, path: str | Path) -> None:
        self._transcript_path = Path(path)

    def on_suggestion(self, cb: Callable[[SuggestionEvent], None]) -> None:
        """Register a callback to be invoked whenever a suggestion fires."""
        self._callbacks.append(cb)

    def clear_callbacks(self) -> None:
        self._callbacks.clear()

    @property
    def poll_interval(self) -> float:
        return self._poll_interval

    @poll_interval.setter
    def poll_interval(self, value: float) -> None:
        if value < 1.0:
            raise ValueError("poll_interval must be >= 1.0 seconds")
        self._poll_interval = float(value)

    # ── Polling loop ────────────────────────────────────────────────────────

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            self._poll()
            # Sleep but bail out immediately if stop is requested
            self._stop_event.wait(timeout=self._poll_interval)

    def _poll(self) -> None:
        """Read new transcript lines, query LLM, fire callbacks."""
        if not self._transcript_path or not self._transcript_path.is_file():
            return

        try:
            new_lines, new_pos = self._read_new_lines()
        except Exception:
            return

        if not new_lines:
            return

        self._last_pos = new_pos
        self._last_ts  = time.time()

        # Build recent transcript string
        recent = "\n".join(new_lines)

        # Skip if character not set
        if not self._character:
            return

        # Build prompt and call LLM
        prompt = build_realtime_suggestion_prompt(
            character=self._character,
            recent_transcript=recent,
            session_context=self._session_context,
        )

        try:
            raw = self._llm(prompt)
        except Exception:
            return

        event = _parse_llm_response(raw)
        if event is None:
            return

        # Priority filter
        if not self._priority_pass(event.priority):
            return

        # Fire callbacks
        for cb in self._callbacks:
            try:
                cb(event)
            except Exception:
                pass   # don't let one callback break the loop

    def _read_new_lines(self) -> tuple[list[str], int]:
        """Read new lines from transcript file since last position.

        Returns (list of new lines, new byte position).
        Raises on any read error.
        """
        path = self._transcript_path
        with path.open("rb") as fh:
            fh.seek(self._last_pos)
            chunk = fh.read()
            new_pos = self._last_pos + len(chunk)

        if not chunk:
            return [], self._last_pos

        # Decode, split, strip
        text = chunk.decode("utf-8", errors="replace")
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        return lines, new_pos

    def _priority_pass(self, p: SuggestionPriority) -> bool:
        order = [SuggestionPriority.LOW, SuggestionPriority.MEDIUM, SuggestionPriority.HIGH]
        try:
            return order.index(p) >= order.index(self._min_priority)
        except ValueError:
            return True

    # ── Serialisation for IPC ───────────────────────────────────────────────

    def event_to_dict(self, event: SuggestionEvent) -> dict:
        return {
            "timestamp":     event.timestamp,
            "seconds":       event.seconds,
            "priority":      event.priority.value,
            "moment_type":   event.moment_type.value,
            "suggestion":    event.suggestion_text,
            "context":       event.context,
        }


# -----------------------------------------------------------------------------
# Convenience: build engine from stored session data
# -----------------------------------------------------------------------------

def build_engine_from_session(
    session_id:       str,
    transcript_path:  str | Path,
    character:        CharacterContext,
    session_context:  str = "",
    *,
    llm_callable:    Callable[[str], str] | None = None,
    poll_interval:   float = 10.0,
    min_priority:    SuggestionPriority = SuggestionPriority.MEDIUM,
) -> SuggestionEngine:
    """Factory: create a pre-configured SuggestionEngine for a session."""
    engine = SuggestionEngine(
        llm_callable=llm_callable,
        poll_interval=poll_interval,
        transcript_path=transcript_path,
        character=character,
        session_context=session_context,
        min_priority=min_priority,
    )
    return engine