"""
Letter generator — creates letters via MiniMax API.

Post-session content generation (M4-T5).
Uses the MiniMax 2.7 API to generate a letter from the PG's perspective,
then persists the result as a GeneratedContent record in the SQLite DB.

Only works for PCs with writing_talent = True.
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

from generators.prompts import CharacterContext, build_letter_prompt


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
    """Return path to roleplay-companion.db — same location Electron uses."""
    import os
    home = Path.home()
    # Electron stores at ~/Library/Application Support/<app-name>/<db-name>
    # On macOS: ~/Library/Application Support/roleplay-companion/roleplay-companion.db
    fallback = home / '.hermes' / 'roleplay-companion.db'

    # Try Electron userData path (macOS default)
    for base in [
        home / 'Library' / 'Application Support' / 'roleplay-companion',
        home / '.hermes',
    ]:
        candidate = base / 'roleplay-companion.db'
        if candidate.exists():
            return candidate
    # Fallback: return the legacy path (will be created on first write)
    return fallback


# -----------------------------------------------------------------------------
# Data model
# -----------------------------------------------------------------------------

@dataclass
class GeneratedContent:
    id:          str
    character_id: str
    session_id:  Optional[str]
    type:        str          # "journal" | "song" | "poetry" | "memory" | "letter" | ...
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


# -----------------------------------------------------------------------------
# Main public API
# -----------------------------------------------------------------------------

def generate_letter(
    session_id: str,
    character_id: str,
    recipient: str,
    purpose: str,
    *,
    db_path: Optional[str | Path] = None,
    llm_callable: Optional[Callable[[str], str]] = None,
    api_key: Optional[str] = None,
) -> GeneratedContent:
    """
    Generate a letter from the PG's perspective after a session.

    Only works for PCs with writing_talent = True.

    Steps:
      1. Load character and session rows from the DB.
      2. Build a MiniMax prompt using build_letter_prompt().
      3. Call MiniMax (or the provided llm_callable for testing).
      4. Persist the result as a GeneratedContent record.
      5. Return the GeneratedContent.

    Args:
        session_id:   The D&D session UUID.
        character_id: The player-character UUID.
        recipient:    Who the letter is addressed to.
        purpose:      Why the letter is being written.
        db_path:      Optional path to the SQLite DB.
                      Defaults to ~/.hermes/roleplay-companion.db.
        llm_callable: Optional override for the LLM call (for unit tests).
        api_key:      Optional MiniMax API key override.

    Returns:
        The newly created GeneratedContent record.

    Raises:
        ValueError: If the character or session is not found,
                    or if the character lacks writing_talent.
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

    # Build character context
    character = _build_character_context(char_row)

    # Check writing talent
    if not char_row.get("writing_talent", False):
        raise ValueError(f"{character.name} non ha talenti nella scrittura")

    # Get session context
    session_context = _format_session_context(sess_row)

    prompt = build_letter_prompt(
        character=character,
        recipient=recipient,
        purpose=purpose,
        session_context=session_context,
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
        type="letter",
        content=raw_content.strip(),
        context=f"Letter from {character.name} to {recipient} ({session_id})",
        generated_at=now,
    )

    _insert_generated_content(conn, record)
    conn.close()

    return record


def _format_session_context(session: dict) -> str:
    """Build a human-readable context string from a session row."""
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


# ─── CLI entrypoint ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys, json

    if len(sys.argv) < 4:
        print(json.dumps({"error": "Usage: letter_generator.py <session_id> <character_id> <recipient> <purpose>"}))
        sys.exit(1)

    session_id   = sys.argv[1]
    character_id = sys.argv[2]
    recipient    = sys.argv[3]
    purpose      = sys.argv[4] if len(sys.argv) > 4 else ""

    try:
        record = generate_letter(session_id, character_id, recipient, purpose)
        # Return a serialisable dict for the IPC caller
        print(json.dumps({
            "id":           record.id,
            "character_id": record.character_id,
            "session_id":   record.session_id,
            "type":         record.type,
            "content":      record.content,
            "context":      record.context,
            "generated_at": record.generated_at,
        }))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)