"""
Memory generator — creates indelible memories from the PG's perspective via MiniMax API.

M4-T2: Post-session content generation — Memory.
Uses the MiniMax 2.7 API to generate a memory from a key moment,
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

from generators.prompts import CharacterContext, build_memory_prompt


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
    hermes_home = Path.home() / ".hermes"
    return hermes_home / "roleplay-companion.db"


# -----------------------------------------------------------------------------
# Data model
# -----------------------------------------------------------------------------

@dataclass
class GeneratedContent:
    id:           str
    character_id: str
    session_id:   Optional[str]
    type:         str  # "journal" | "song" | "poetry" | "memory" | ...
    content:      str
    context:      str
    generated_at: float


# -----------------------------------------------------------------------------
# DB helpers (mirrors journal_generator.py)
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


def _fetch_key_moments(conn: sqlite3.Connection, session_id: str) -> list[dict]:
    """Fetch key moments for a session from meet_sessions.db."""
    # Try to load key moments from the meet_sessions database
    meet_db = Path.home() / ".hermes" / "meet_sessions.db"
    if not meet_db.exists():
        return []

    try:
        meet_conn = sqlite3.connect(str(meet_db), check_same_thread=False)
        meet_conn.row_factory = sqlite3.Row
        rows = meet_conn.execute(
            """
            SELECT summary, text, kind, confidence
            FROM key_moments
            WHERE session_id = ?
            ORDER BY confidence DESC, seconds ASC
            LIMIT 5
            """,
            (session_id,),
        ).fetchall()
        meet_conn.close()
        return [dict(r) for r in rows]
    except Exception:
        return []


def _build_character_context(char_row: dict) -> CharacterContext:
    """Map a characters DB row to a CharacterContext prompt model."""
    return CharacterContext(
        name=char_row.get("name", ""),
        race=char_row.get("race", ""),
        character_class=char_row.get("class", ""),
        backstory=char_row.get("backstory", ""),
        personality_traits=char_row.get("personality_traits", ""),
        motivations=char_row.get("motivations", ""),
        dreams=char_row.get("dreams", ""),
        fears=char_row.get("fears", ""),
        goals_long_term=char_row.get("goals_long_term", ""),
        goals_short_term=char_row.get("goals_short_term", ""),
        catchphrases=[],
        iconic_items=[],
    )


# -----------------------------------------------------------------------------
# Main public API
# -----------------------------------------------------------------------------

def generate_memory(
    session_id: str,
    character_id: str,
    *,
    key_moment: Optional[str] = None,
    pg_relevance: Optional[str] = None,
    db_path: Optional[str | Path] = None,
    llm_callable: Optional[Callable[[str], str]] = None,
    api_key: Optional[str] = None,
) -> GeneratedContent:
    """
    Generate an indelible memory for a PG from a key moment in a session.

    Steps:
      1. Load character and session rows from the DB.
      2. Load key moments for the session (from meet_sessions.db if available).
      3. Build a MiniMax prompt using build_memory_prompt().
      4. Call MiniMax (or the provided llm_callable for testing).
      5. Persist the result as a GeneratedContent record.
      6. Return the GeneratedContent.

    Args:
        session_id:    The D&D session UUID.
        character_id:  The player-character UUID.
        key_moment:    Optional explicit key moment string.
                       If not provided, the highest-confidence moment from the
                       session is used.
        pg_relevance:  Optional explicit relevance description.
                       If not provided, derived from the moment.
        db_path:       Optional path to the SQLite DB.
                       Defaults to ~/.hermes/roleplay-companion.db.
        llm_callable:  Optional override for the LLM call (for unit tests).
        api_key:       Optional MiniMax API key override.

    Returns:
        The newly created GeneratedContent record (type="memory").

    Raises:
        ValueError: If the character or session is not found.
        RuntimeError: If the LLM call fails or no key moment is available.
    """
    dbp = Path(db_path) if db_path else _default_db_path()

    conn = sqlite3.connect(str(dbp), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    _ensure_schema(conn)

    # Load rows
    char_row = _fetch_character(conn, character_id)
    sess_row = _fetch_session(conn, session_id)

    if char_row is None:
        raise ValueError(f"Character not found: {character_id}")
    if sess_row is None:
        raise ValueError(f"Session not found: {session_id}")

    # Load key moments (unless explicitly provided)
    if key_moment is None:
        moments = _fetch_key_moments(conn, session_id)
        if moments:
            top = moments[0]
            key_moment = f"[{top['kind']}] {top['text']}"
            if top.get("summary"):
                key_moment += f"\nSummary: {top['summary']}"
        else:
            key_moment = f"Sessione '{sess_row.get('title', '')}' - momento non specificato"

    # Build relevance string (unless explicitly provided)
    if pg_relevance is None:
        pg_relevance = (
            f"{char_row.get('name', 'Il PG')} ha vissuto questo momento durante "
            f"la sessione '{sess_row.get('title', '')}'. "
            f"È un momento che lo ha segnato profondamente."
        )

    # Build prompt input
    character = _build_character_context(char_row)

    prompt = build_memory_prompt(
        character=character,
        key_moment=key_moment,
        pg_relevance=pg_relevance,
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
        type="memory",
        content=raw_content.strip(),
        context=f"Memory from session '{sess_row.get('title', '')}' ({session_id}): {key_moment[:100]}",
        generated_at=now,
    )

    _insert_generated_content(conn, record)
    conn.close()

    return record