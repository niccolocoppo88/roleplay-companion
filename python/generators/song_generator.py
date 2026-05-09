"""
Song generator — generates a song/ballad from a PG's perspective via MiniMax API.

M4-T4: Post-session content generation — Song.
Uses the MiniMax 2.7 API to generate a song based on session events and key moments,
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

from generators.prompts import CharacterContext, build_song_prompt


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
class SongResult:
    """Result of song generation."""
    id: str
    character_id: str
    session_id: Optional[str]
    title: str
    lyrics: str
    chords: str
    generated_at: float


# -----------------------------------------------------------------------------
# DB helpers
# -----------------------------------------------------------------------------

_SONG_SCHEMA = """
CREATE TABLE IF NOT EXISTS songs (
    id           TEXT PRIMARY KEY,
    character_id TEXT NOT NULL,
    session_id   TEXT,
    title        TEXT NOT NULL,
    lyrics       TEXT NOT NULL,
    chords       TEXT NOT NULL,
    generated_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_song_character ON songs(character_id);
CREATE INDEX IF NOT EXISTS idx_song_session  ON songs(session_id);
"""


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(_SONG_SCHEMA)


def _insert_song(conn: sqlite3.Connection, record: SongResult) -> None:
    conn.execute(
        """
        INSERT OR REPLACE INTO songs
            (id, character_id, session_id, title, lyrics, chords, generated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            record.id,
            record.character_id,
            record.session_id,
            record.title,
            record.lyrics,
            record.chords,
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
        musical_talent=bool(char_row.get("musical_talent", False)),
        writing_talent=bool(char_row.get("writing_talent", False)),
    )


# -----------------------------------------------------------------------------
# Response parsing
# -----------------------------------------------------------------------------

def _parse_song_response(response: str) -> tuple[str, str, str]:
    """
    Parse the MiniMax response and extract song title, lyrics, and chords.

    Returns:
        Tuple of (title, lyrics, chords)
    """
    response = response.strip()

    # Try to extract title (first line with # or TITOLO:)
    title = "Canzone senza titolo"
    lyrics_lines = []
    chords = ""

    lines = response.split("\n")
    in_lyrics = False
    in_chords = False
    current_section = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Title detection
        if line.upper().startswith("TITOLO:") or line.startswith("#"):
            title = line.split(":", 1)[-1].strip().lstrip("#").strip()
            continue

        # Chords section detection
        if "ACCORDI" in line.upper() or "CHORDS" in line.upper():
            in_chords = True
            in_lyrics = False
            continue

        if in_chords:
            chords += line + "\n"
        elif line.startswith("RITORNELLO") or line.startswith("CORO"):
            in_lyrics = True
            current_section = []
        elif line.startswith("STROFA") or line.startswith("VERSO"):
            if current_section:
                lyrics_lines.append("\n".join(current_section))
            current_section = []
            in_lyrics = True
        elif in_lyrics:
            current_section.append(line)

    # Add remaining section
    if current_section:
        lyrics_lines.append("\n".join(current_section))

    lyrics = "\n\n".join(lyrics_lines)

    return title, lyrics, chords


# -----------------------------------------------------------------------------
# Main public API
# -----------------------------------------------------------------------------

def generate_song(
    character_id: str,
    session_events: str,
    key_moments: str,
    *,
    session_id: Optional[str] = None,
    db_path: Optional[str | Path] = None,
    llm_callable: Optional[Callable[[str], str]] = None,
    api_key: Optional[str] = None,
) -> SongResult:
    """
    Generate a song/ballad from the PG's perspective after a session.

    Steps:
      1. Load character row from the DB.
      2. Verify the character has musical_talent=True.
      3. Build a MiniMax prompt using build_song_prompt().
      4. Call MiniMax (or the provided llm_callable for testing).
      5. Parse the response to extract title, lyrics, and chords.
      6. Persist the result as a SongResult record.
      7. Return the SongResult.

    Args:
        character_id:    The player-character UUID.
        session_events:  Summary of what happened in the session.
        key_moments:     Key moments identified during the session.
        session_id:      Optional D&D session UUID.
        db_path:         Optional path to the SQLite DB.
                         Defaults to ~/.hermes/roleplay-companion.db.
        llm_callable:    Optional override for the LLM call (for unit tests).
        api_key:         Optional MiniMax API key override.

    Returns:
        The newly created SongResult.

    Raises:
        ValueError: If the character is not found or lacks musical talent.
        RuntimeError: If the LLM call fails.
    """
    dbp = Path(db_path) if db_path else _default_db_path()

    conn = sqlite3.connect(str(dbp), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    _ensure_schema(conn)

    # Load character
    char_row = _fetch_character(conn, character_id)
    if char_row is None:
        raise ValueError(f"Character not found: {character_id}")

    # Check musical talent
    if not char_row.get("musical_talent"):
        raise ValueError(f"{char_row.get('name')} non ha talenti musicali")

    # Build character context
    character = _build_character_context(char_row)

    # Build prompt
    prompt = build_song_prompt(
        character=character,
        session_events=session_events,
        key_moments=key_moments,
    )

    # Call LLM
    if llm_callable is not None:
        raw_response = llm_callable(prompt)
    else:
        raw_response = _call_minimax(prompt, api_key=api_key)

    if not raw_response or not raw_response.strip():
        raise RuntimeError("MiniMax returned empty content")

    # Parse response
    title, lyrics, chords = _parse_song_response(raw_response)

    # Persist
    now = time.time()
    record = SongResult(
        id=str(uuid.uuid4()),
        character_id=character_id,
        session_id=session_id,
        title=title,
        lyrics=lyrics,
        chords=chords,
        generated_at=now,
    )

    _insert_song(conn, record)
    conn.close()

    return record