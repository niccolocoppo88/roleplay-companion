"""
Item generator — generates iconic item descriptions via MiniMax API.

M4-T6: Post-session content generation — Iconic Item.
Uses the MiniMax 2.7 API to generate a rich, evocative description of an iconic
object, then persists the result as a GeneratedContent record in the SQLite DB.
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

from generators.prompts import CharacterContext, build_item_description_prompt


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
class ItemDescriptionResult:
    """Result of iconic item description generation."""
    id: str
    character_id: str
    session_id: Optional[str]
    item_name: str
    description: str
    generated_at: float


# -----------------------------------------------------------------------------
# DB helpers
# -----------------------------------------------------------------------------

_ITEM_SCHEMA = """
CREATE TABLE IF NOT EXISTS iconic_items (
    id           TEXT PRIMARY KEY,
    character_id TEXT NOT NULL,
    session_id   TEXT,
    item_name    TEXT NOT NULL,
    description  TEXT NOT NULL,
    generated_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ii_character ON iconic_items(character_id);
CREATE INDEX IF NOT EXISTS idx_ii_session  ON iconic_items(session_id);
"""


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(_ITEM_SCHEMA)


def _insert_item(conn: sqlite3.Connection, record: ItemDescriptionResult) -> None:
    conn.execute(
        """
        INSERT OR REPLACE INTO iconic_items
            (id, character_id, session_id, item_name, description, generated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            record.id,
            record.character_id,
            record.session_id,
            record.item_name,
            record.description,
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
    )


# -----------------------------------------------------------------------------
# Response parsing
# -----------------------------------------------------------------------------

def _parse_item_description_response(response: str) -> tuple[str, str]:
    """
    Parse the MiniMax response and extract item name and description.

    Returns:
        Tuple of (item_name, description)
    """
    response = response.strip()

    # Look for the item name in the first line or a "Nome:" marker
    lines = response.split("\n")
    item_name = ""
    description_lines = []
    capturing_description = False

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Extract item name if found
        if line.startswith("Nome:") or line.startswith("Item:"):
            item_name = line.split(":", 1)[1].strip().strip('"')
        elif line.startswith("Nome dell'oggetto:") or line.startswith("Oggetto:"):
            item_name = line.split(":", 1)[1].strip().strip('"')
        elif capturing_description:
            description_lines.append(line)
        elif "descrizione" in line.lower() and ":" in line:
            capturing_description = True
            desc_part = line.split(":", 1)[1].strip()
            if desc_part:
                description_lines.append(desc_part)
        elif len(description_lines) == 0 and not item_name:
            # First non-empty line might be the name
            if len(lines) == 1 or "storia" in line.lower() or "significato" in line.lower():
                item_name = line
            else:
                description_lines.append(line)
        else:
            description_lines.append(line)

    description = " ".join(description_lines)

    if not item_name and description_lines:
        # Fallback: use first line as name if nothing found
        item_name = description_lines[0][:50]

    if not description:
        description = response

    return item_name, description


# -----------------------------------------------------------------------------
# Main public API
# -----------------------------------------------------------------------------

def generate_item_description(
    character_id: str,
    item_name: str,
    item_origin: str,
    session_context: str,
    *,
    session_id: Optional[str] = None,
    db_path: Optional[str | Path] = None,
    llm_callable: Optional[Callable[[str], str]] = None,
    api_key: Optional[str] = None,
) -> ItemDescriptionResult:
    """
    Generate an iconic item description for a character.

    Steps:
      1. Load character row from the DB.
      2. Build a MiniMax prompt using build_item_description_prompt().
      3. Call MiniMax (or the provided llm_callable for testing).
      4. Parse the response to extract item name and description.
      5. Persist the result as an ItemDescriptionResult record.
      6. Return the ItemDescriptionResult.

    Args:
        character_id:   The player-character UUID.
        item_name:      Name of the iconic item.
        item_origin:    Origin/history of the item.
        session_context: Contextual information about the session/moment.
        session_id:      Optional D&D session UUID.
        db_path:         Optional path to the SQLite DB.
                         Defaults to ~/.hermes/roleplay-companion.db.
        llm_callable:    Optional override for the LLM call (for unit tests).
        api_key:         Optional MiniMax API key override.

    Returns:
        The newly created ItemDescriptionResult.

    Raises:
        ValueError: If the character is not found.
        RuntimeError: If the LLM call fails or no description is produced.
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
    prompt = build_item_description_prompt(
        character=character,
        item_name=item_name,
        item_origin=item_origin,
        session_context=session_context,
    )

    # Call LLM
    if llm_callable is not None:
        raw_response = llm_callable(prompt)
    else:
        raw_response = _call_minimax(prompt, api_key=api_key)

    if not raw_response or not raw_response.strip():
        raise RuntimeError("MiniMax returned empty content")

    # Parse response
    extracted_name, description = _parse_item_description_response(raw_response)

    if not description:
        raise RuntimeError("No item description found in response")

    # Use provided item_name as primary, fallback to extracted
    final_name = item_name or extracted_name

    # Persist
    now = time.time()
    record = ItemDescriptionResult(
        id=str(uuid.uuid4()),
        character_id=character_id,
        session_id=session_id,
        item_name=final_name,
        description=description,
        generated_at=now,
    )

    _insert_item(conn, record)
    conn.close()

    return record