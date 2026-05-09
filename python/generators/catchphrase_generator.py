"""
Catchphrase generator — extracts or generates iconic catchphrases from PG dialogue via MiniMax API.

M4-T3: Post-session content generation — Catchphrase.
Uses the MiniMax 2.7 API to extract or generate a catchphrase from recent dialogue,
then persists the result as a GeneratedContent record in the SQLite DB.
"""

from __future__ import annotations

import os
import sqlite3
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

import requests

from generators.prompts import CharacterContext, build_catchphrase_prompt


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
class CatchphraseResult:
    """Result of catchphrase extraction/generation."""
    id: str
    character_id: str
    session_id: Optional[str]
    catchphrase: str
    context: str
    is_existing: bool
    generated_at: float


# -----------------------------------------------------------------------------
# DB helpers
# -----------------------------------------------------------------------------

_CATCHPHRASE_SCHEMA = """
CREATE TABLE IF NOT EXISTS catchphrases (
    id           TEXT PRIMARY KEY,
    character_id TEXT NOT NULL,
    session_id   TEXT,
    catchphrase  TEXT NOT NULL,
    context      TEXT NOT NULL,
    is_existing  INTEGER NOT NULL DEFAULT 0,
    generated_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cp_character ON catchphrases(character_id);
CREATE INDEX IF NOT EXISTS idx_cp_session  ON catchphrases(session_id);
"""


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(_CATCHPHRASE_SCHEMA)


def _insert_catchphrase(conn: sqlite3.Connection, record: CatchphraseResult) -> None:
    conn.execute(
        """
        INSERT OR REPLACE INTO catchphrases
            (id, character_id, session_id, catchphrase, context, is_existing, generated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            record.id,
            record.character_id,
            record.session_id,
            record.catchphrase,
            record.context,
            1 if record.is_existing else 0,
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
        "max_tokens": 512,
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
# Response parsing
# -----------------------------------------------------------------------------

def _parse_catchphrase_response(response: str) -> tuple[Optional[str], bool]:
    """
    Parse the MiniMax response and extract the catchphrase.

    Returns:
        Tuple of (catchphrase or None, is_existing)
        is_existing=True means it was an existing catchphrase reiterated
    """
    response = response.strip()

    if response.startswith("BATTUTA_ESISTENTE:"):
        # Existing catchphrase
        catchphrase = response.replace("BATTUTA_ESISTENTE:", "").strip()
        return catchphrase, True

    if response.startswith("NUOVA_BATTUTA:"):
        # New catchphrase - extract just the catchphrase line
        lines = response.split("\n")
        catchphrase = lines[0].replace("NUOVA_BATTUTA:", "").strip()
        return catchphrase, False

    # NESSUNA_BATTUTA or unrecognized format
    return None, False


# -----------------------------------------------------------------------------
# Main public API
# -----------------------------------------------------------------------------

def extract_catchphrase(
    character_id: str,
    recent_dialogue: str,
    context: str,
    *,
    session_id: Optional[str] = None,
    db_path: Optional[str | Path] = None,
    llm_callable: Optional[Callable[[str], str]] = None,
    api_key: Optional[str] = None,
) -> CatchphraseResult:
    """
    Extract or generate an iconic catchphrase from the PG's recent dialogue.

    Steps:
      1. Load character row from the DB.
      2. Build a MiniMax prompt using build_catchphrase_prompt().
      3. Call MiniMax (or the provided llm_callable for testing).
      4. Parse the response to extract the catchphrase.
      5. Persist the result as a CatchphraseResult record.
      6. Return the CatchphraseResult.

    Args:
        character_id:   The player-character UUID.
        recent_dialogue: The PG's recent dialogue to analyze.
        context:         Contextual information about the moment/session.
        session_id:      Optional D&D session UUID.
        db_path:         Optional path to the SQLite DB.
                         Defaults to ~/.hermes/roleplay-companion.db.
        llm_callable:    Optional override for the LLM call (for unit tests).
        api_key:         Optional MiniMax API key override.

    Returns:
        The newly created CatchphraseResult.

    Raises:
        ValueError: If the character is not found.
        RuntimeError: If the LLM call fails or no catchphrase is found.
    """
    dbp = Path(db_path) if db_path else _default_db_path()

    conn = sqlite3.connect(str(dbp), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    _ensure_schema(conn)

    # Load character
    char_row = _fetch_character(conn, character_id)
    if char_row is None:
        raise ValueError(f"Character not found: {character_id}")

    # Build character context
    character = _build_character_context(char_row)

    # Build prompt
    prompt = build_catchphrase_prompt(
        character=character,
        recent_dialogue=recent_dialogue,
        context=context,
    )

    # Call LLM
    if llm_callable is not None:
        raw_response = llm_callable(prompt)
    else:
        raw_response = _call_minimax(prompt, api_key=api_key)

    if not raw_response or not raw_response.strip():
        raise RuntimeError("MiniMax returned empty content")

    # Parse response
    catchphrase, is_existing = _parse_catchphrase_response(raw_response)

    if catchphrase is None:
        raise RuntimeError("No catchphrase found in response")

    # Persist
    now = time.time()
    record = CatchphraseResult(
        id=str(uuid.uuid4()),
        character_id=character_id,
        session_id=session_id,
        catchphrase=catchphrase,
        context=context,
        is_existing=is_existing,
        generated_at=now,
    )

    _insert_catchphrase(conn, record)
    conn.close()

    return record