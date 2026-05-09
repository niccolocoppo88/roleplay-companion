"""
Journal generator — creates first-person diary entries via MiniMax API.

Post-session content generation (M4-T1).
Uses the MiniMax 2.7 API to generate a diary entry from the PG's perspective,
then persists the result as a GeneratedContent record in the SQLite DB.
"""

from __future__ import annotations

import os
import sqlite3
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

import requests

from generators.prompts import CharacterContext, build_journal_prompt


# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------

_MINIMAX_API_URL = "https://api.minimax.io/v1/text/chatcompletion_pro"
_MINIMAX_MODEL  = "MiniMax-Text-01"


def _get_api_key() -> str:
    key = os.environ.get("MINIMAX_API_KEY") or os.environ.get("MINIMAX_API_TOKEN")
    if not key:
        raise ValueError("MINIMAX_API_KEY (or MINIMAX_API_TOKEN) is not set")
    return key


def _default_db_path() -> Path:
    """Return path to roleplay-companion.db (same directory as hermes home)."""
    # Mirror the approach used by meet_session_store — use ~/.hermes as base
    hermes_home = Path.home() / ".hermes"
    return hermes_home / "roleplay-companion.db"


# -----------------------------------------------------------------------------
# Data model
# -----------------------------------------------------------------------------

@dataclass
class GeneratedContent:
    id:          str
    character_id: str
    session_id:  Optional[str]
    type:        str          # "journal" | "song" | "poetry" | "memory" | ...
    content:     str
    context:      str
    generated_at: float       # unix epoch


# -----------------------------------------------------------------------------
# DB helpers
# -----------------------------------------------------------------------------

_GENERATED_CONTENT_SCHEMA = """
CREATE TABLE IF NOT EXISTS generated_contents (
    id           TEXT PRIMARY KEY,
    character_id TEXT NOT NULL,
    session_id   TEXT,
    type         TEXT NOT NULL,
    content      TEXT NOT NULL,
    context      TEXT NOT NULL,
    generated_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gc_character ON generated_contents(character_id);
CREATE INDEX IF NOT EXISTS idx_gc_session  ON generated_contents(session_id);
"""


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(_GENERATED_CONTENT_SCHEMA)


def _insert_generated_content(
    conn: sqlite3.Connection,
    record: GeneratedContent,
) -> None:
    conn.execute(
        """
        INSERT OR REPLACE INTO generated_contents
            (id, character_id, session_id, type, content, context, generated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            record.id,
            record.character_id,
            record.session_id,
            record.type,
            record.content,
            record.context,
            record.generated_at,
        ),
    )
    conn.commit()


# -----------------------------------------------------------------------------
# MiniMax API caller
# -----------------------------------------------------------------------------

def _call_minimax(prompt: str, *, api_key: Optional[str] = None) -> str:
    """Call MiniMax chat completion API and return the assistant's text."""
    key = api_key or _get_api_key()

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": _MINIMAX_MODEL,
        "messages": [
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.8,
        "max_tokens": 1024,
    }

    response = requests.post(
        _MINIMAX_API_URL,
        json=payload,
        headers=headers,
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()

    # MiniMax returns: { "choices": [{ "messages": [{ "role": "assistant", "content": "..." }] }] }
    choices = data.get("choices", [])
    if not choices:
        raise ValueError(f"Unexpected MiniMax response format: {data}")
    return choices[0]["messages"][0]["content"]


# -----------------------------------------------------------------------------
# Character & session fetching helpers
# -----------------------------------------------------------------------------

def _fetch_character(conn: sqlite3.Connection, character_id: str) -> Optional[dict]:
    row = conn.execute(
        "SELECT * FROM characters WHERE id = ?", (character_id,)
    ).fetchone()
    return dict(row) if row else None


def _fetch_session(conn: sqlite3.Connection, session_id: str) -> Optional[dict]:
    row = conn.execute(
        "SELECT * FROM sessions WHERE id = ?", (session_id,)
    ).fetchone()
    return dict(row) if row else None


def _build_character_context(char_row: dict) -> CharacterContext:
    """Map a characters DB row to a CharacterContext prompt model."""
    return CharacterContext(
        name=char_row.get("name", ""),
        race=char_row.get("race", ""),
        character_class=char_row.get("class", ""),
        backstory=char_row.get("backstory", ""),
        personality_traits="",       # not stored in v1 schema
        motivations="",               # not stored in v1 schema
        dreams="",                    # not stored in v1 schema
        fears="",                     # not stored in v1 schema
        goals_long_term="",          # not stored in v1 schema
        goals_short_term="",         # not stored in v1 schema
        catchphrases=[],             # not stored in v1 schema
        iconic_items=[],             # not stored in v1 schema
    )


def _format_session_events(session: dict) -> str:
    """Build a human-readable events string from a session row."""
    title = session.get("title", "Sessione senza titolo")
    started = session.get("started_at")
    ended   = session.get("ended_at")
    lines   = session.get("total_lines", 0)

    parts = [f"Titolo: {title}"]
    if started:
        parts.append(f"Iniziata: {datetime.fromtimestamp(started, tz=timezone.utc).isoformat()}")
    if ended:
        parts.append(f"Finita: {datetime.fromtimestamp(ended, tz=timezone.utc).isoformat()}")
    parts.append(f"Linee transcript: {lines}")
    return "\n".join(parts)


# -----------------------------------------------------------------------------
# Main public API
# -----------------------------------------------------------------------------

def generate_journal(
    session_id: str,
    character_id: str,
    *,
    db_path: Optional[str | Path] = None,
    llm_callable: Optional[Callable[[str], str]] = None,
    api_key: Optional[str] = None,
) -> GeneratedContent:
    """
    Generate a first-person journal/diary entry for a PG after a session.

    Steps:
      1. Load character and session rows from the DB.
      2. Build a MiniMax prompt using build_journal_prompt().
      3. Call MiniMax (or the provided llm_callable for testing).
      4. Persist the result as a GeneratedContent record.
      5. Return the GeneratedContent.

    Args:
        session_id:   The D&D session UUID.
        character_id: The player-character UUID.
        db_path:      Optional path to the SQLite DB.
                      Defaults to ~/.hermes/roleplay-companion.db.
        llm_callable: Optional override for the LLM call (for unit tests).
        api_key:      Optional MiniMax API key override.

    Returns:
        The newly created GeneratedContent record.

    Raises:
        ValueError: If the character or session is not found.
        RuntimeError: If the LLM call fails.
    """
    dbp = Path(db_path) if db_path else _default_db_path()

    conn = sqlite3.connect(str(dbp), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    _ensure_schema(conn)

    # Load rows
    char_row   = _fetch_character(conn, character_id)
    sess_row   = _fetch_session(conn, session_id)

    if char_row is None:
        raise ValueError(f"Character not found: {character_id}")
    if sess_row is None:
        raise ValueError(f"Session not found: {session_id}")

    # Build prompt input
    character = _build_character_context(char_row)
    session_events = _format_session_events(sess_row)
    key_moments = ""  # TODO: fetch key moments for this session if available

    prompt = build_journal_prompt(
        character=character,
        session_title=sess_row.get("title", ""),
        session_events=session_events,
        key_moments=key_moments,
    )

    # Call LLM
    if llm_callable is not None:
        raw_content = llm_callable(prompt)
    else:
        raw_content = _call_minimax(prompt, api_key=api_key)

    if not raw_content or not raw_content.strip():
        raise RuntimeError("MiniMax returned empty content")

    # Persist
    now = time.time()
    record = GeneratedContent(
        id=str(uuid.uuid4()),
        character_id=character_id,
        session_id=session_id,
        type="journal",
        content=raw_content.strip(),
        context=f"Journal entry for session '{sess_row.get('title', '')}' ({session_id})",
        generated_at=now,
    )

    _insert_generated_content(conn, record)
    conn.close()

    return record