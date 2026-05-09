"""Meeting session storage — persists transcript records and key moments.

Uses a dedicated SQLite DB (``meet_sessions.db``) alongside the main
``state.db``, so the schema can evolve independently of the session store.

Database schema::

    CREATE TABLE meeting_sessions (
        id               TEXT PRIMARY KEY,
        hermes_session_id TEXT,      -- link to sessions.id in state.db (optional)
        meeting_url      TEXT,
        meeting_id       TEXT,
        title            TEXT,
        started_at       REAL,       -- unix epoch
        ended_at         REAL,
        status           TEXT,       -- 'active' | 'done' | 'abandoned'
        mode             TEXT,       -- 'transcribe' | 'realtime'
        total_lines      INTEGER DEFAULT 0,
        total_moments    INTEGER DEFAULT 0,
        speaker_count    INTEGER DEFAULT 0,
        language         TEXT DEFAULT 'en',
        notes            TEXT,
        raw_transcript_path TEXT,    -- path to the meet_bot transcript.txt
        created_at       REAL
    );

    CREATE TABLE transcript_records (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id      TEXT NOT NULL REFERENCES meeting_sessions(id),
        timestamp       TEXT,         -- "HH:MM:SS"
        seconds         INTEGER,      -- seconds since midnight
        speaker         TEXT,
        text            TEXT,
        raw             TEXT,         -- original line
        created_at      REAL,
        UNIQUE(session_id, seconds, speaker, text)
    );

    CREATE TABLE key_moments (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id      TEXT NOT NULL REFERENCES meeting_sessions(id),
        kind            TEXT NOT NULL,  -- question|decision|action_item|important_point|topic_change
        seconds         INTEGER,
        timestamp       TEXT,
        speaker         TEXT,
        text            TEXT,
        summary         TEXT,
        confidence      REAL,
        triggered_on    TEXT,
        created_at      REAL
    );

    CREATE INDEX IF NOT EXISTS idx_trec_session ON transcript_records(session_id);
    CREATE INDEX IF NOT EXISTS idx_km_session  ON key_moments(session_id);
    CREATE INDEX IF NOT EXISTS idx_km_kind     ON key_moments(kind);
"""

from __future__ import annotations

import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Optional

from hermes_constants import get_hermes_home
from meet_transcript_parser import TranscriptRecord, parse_transcript
from meet_key_moments import KeyMoment, detect_moments


# -----------------------------------------------------------------------------
# Database path & schema
# -----------------------------------------------------------------------------

_MEET_DB_NAME = "meet_sessions.db"


def _db_path() -> Path:
    return get_hermes_home() / _MEET_DB_NAME


_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS meeting_sessions (
    id                   TEXT PRIMARY KEY,
    hermes_session_id    TEXT,
    meeting_url          TEXT,
    meeting_id           TEXT,
    title                TEXT,
    started_at           REAL,
    ended_at             REAL,
    status               TEXT DEFAULT 'active',
    mode                 TEXT DEFAULT 'transcribe',
    total_lines          INTEGER DEFAULT 0,
    total_moments        INTEGER DEFAULT 0,
    speaker_count        INTEGER DEFAULT 0,
    language             TEXT DEFAULT 'en',
    notes                TEXT,
    raw_transcript_path  TEXT,
    created_at           REAL
);

CREATE TABLE IF NOT EXISTS transcript_records (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES meeting_sessions(id),
    timestamp   TEXT,
    seconds     INTEGER,
    speaker     TEXT,
    text        TEXT,
    raw         TEXT,
    created_at  REAL,
    UNIQUE(session_id, seconds, speaker, text)
);

CREATE TABLE IF NOT EXISTS key_moments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   TEXT NOT NULL REFERENCES meeting_sessions(id),
    kind         TEXT NOT NULL,
    seconds      INTEGER,
    timestamp    TEXT,
    speaker      TEXT,
    text         TEXT,
    summary      TEXT,
    confidence   REAL,
    triggered_on TEXT,
    created_at   REAL,
    UNIQUE(session_id, kind, seconds, speaker, text)
);

CREATE INDEX IF NOT EXISTS idx_trec_session ON transcript_records(session_id);
CREATE INDEX IF NOT EXISTS idx_km_session  ON key_moments(session_id);
CREATE INDEX IF NOT EXISTS idx_km_kind     ON key_moments(kind);
"""


# -----------------------------------------------------------------------------
# Connection manager
# -----------------------------------------------------------------------------

_lock = threading.Lock()
_conn: Optional[sqlite3.Connection] = None


def _get_conn() -> sqlite3.Connection:
    global _conn
    with _lock:
        if _conn is None:
            p = _db_path()
            p.parent.mkdir(parents=True, exist_ok=True)
            _conn = sqlite3.connect(str(p), check_same_thread=False)
            _conn.execute("PRAGMA journal_mode=WAL")
            _conn.execute("PRAGMA foreign_keys=ON")
            _conn.row_factory = sqlite3.Row
            _conn.executescript(_SCHEMA_SQL)
        return _conn


# -----------------------------------------------------------------------------
# Data access objects
# -----------------------------------------------------------------------------

class MeetingSessionStore:
    """Persist meeting sessions, transcript records, and key moments."""

    def __init__(self, conn: Optional[sqlite3.Connection] = None):
        self._conn = conn

    @property
    def conn(self) -> sqlite3.Connection:
        return self._conn or _get_conn()

    # ── Session CRUD ────────────────────────────────────────────────────────

    def create_session(
        self,
        session_id: str,
        *,
        hermes_session_id: Optional[str] = None,
        meeting_url: str = "",
        meeting_id: str = "",
        title: str = "",
        started_at: Optional[float] = None,
        mode: str = "transcribe",
        raw_transcript_path: str = "",
    ) -> dict:
        """Create a new meeting session record. Returns the inserted row."""
        now = time.time()
        self.conn.execute(
            """
            INSERT INTO meeting_sessions
                (id, hermes_session_id, meeting_url, meeting_id, title,
                 started_at, status, mode, raw_transcript_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
            """,
            (
                session_id,
                hermes_session_id,
                meeting_url,
                meeting_id,
                title,
                started_at or now,
                mode,
                raw_transcript_path,
                now,
            ),
        )
        self.conn.commit()
        return self.get_session(session_id) or {}

    def get_session(self, session_id: str) -> Optional[dict]:
        """Return a session row, or None if not found."""
        row = self.conn.execute(
            "SELECT * FROM meeting_sessions WHERE id = ?", (session_id,)
        ).fetchone()
        return dict(row) if row else None

    def update_session_stats(
        self,
        session_id: str,
        *,
        total_lines: Optional[int] = None,
        total_moments: Optional[int] = None,
        speaker_count: Optional[int] = None,
        status: Optional[str] = None,
        ended_at: Optional[float] = None,
        notes: Optional[str] = None,
    ) -> None:
        """Incrementally update session counters and status."""
        fields, vals = [], []
        if total_lines is not None:
            fields.append("total_lines = ?")
            vals.append(total_lines)
        if total_moments is not None:
            fields.append("total_moments = ?")
            vals.append(total_moments)
        if speaker_count is not None:
            fields.append("speaker_count = ?")
            vals.append(speaker_count)
        if status is not None:
            fields.append("status = ?")
            vals.append(status)
        if ended_at is not None:
            fields.append("ended_at = ?")
            vals.append(ended_at)
        if notes is not None:
            fields.append("notes = ?")
            vals.append(notes)
        if not fields:
            return
        vals.append(session_id)
        self.conn.execute(
            f"UPDATE meeting_sessions SET {', '.join(fields)} WHERE id = ?",
            vals,
        )
        self.conn.commit()

    def end_session(
        self,
        session_id: str,
        *,
        status: str = "done",
        notes: str = "",
    ) -> None:
        """Mark a session as ended."""
        self.update_session_stats(
            session_id,
            status=status,
            ended_at=time.time(),
            notes=notes,
        )

    def list_sessions(
        self,
        *,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict]:
        """Return recent sessions, most recent first."""
        q = "SELECT * FROM meeting_sessions"
        params: list = []
        if status:
            q += " WHERE status = ?"
            params.append(status)
        q += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        return [dict(r) for r in self.conn.execute(q, params).fetchall()]

    # ── Transcript records ──────────────────────────────────────────────────

    def insert_records(
        self,
        session_id: str,
        records: list[TranscriptRecord],
    ) -> int:
        """Bulk-insert transcript records, skipping duplicates.

        Returns the number of rows actually inserted.
        """
        now = time.time()
        inserted = 0
        for rec in records:
            cur = self.conn.execute(
                """
                INSERT OR IGNORE INTO transcript_records
                    (session_id, timestamp, seconds, speaker, text, raw, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    f"{rec.timestamp.hour:02d}:{rec.timestamp.minute:02d}:{rec.timestamp.second:02d}",
                    rec.seconds,
                    rec.speaker,
                    rec.text,
                    rec.raw,
                    now,
                ),
            )
            if cur.rowcount > 0:
                inserted += 1
        self.conn.commit()
        return inserted

    def get_records(
        self,
        session_id: str,
        *,
        last: Optional[int] = None,
    ) -> list[dict]:
        """Return transcript records for a session, newest last."""
        q = (
            "SELECT * FROM transcript_records "
            "WHERE session_id = ? ORDER BY seconds ASC"
        )
        rows = self.conn.execute(q, (session_id,)).fetchall()
        result = [dict(r) for r in rows]
        if last:
            result = result[-last:]
        return result

    # ── Key moments ────────────────────────────────────────────────────────

    def insert_moments(
        self,
        session_id: str,
        moments: list[KeyMoment],
    ) -> int:
        """Bulk-insert key moments. Returns count inserted."""
        now = time.time()
        inserted = 0
        for m in moments:
            cur = self.conn.execute(
                """
                INSERT OR IGNORE INTO key_moments
                    (session_id, kind, seconds, timestamp, speaker,
                     text, summary, confidence, triggered_on, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    m.kind.value,
                    m.seconds,
                    f"{m.timestamp.hour:02d}:{m.timestamp.minute:02d}:{m.timestamp.second:02d}",
                    m.speaker,
                    m.text,
                    m.summary,
                    m.confidence,
                    m.triggered_on,
                    now,
                ),
            )
            if cur.rowcount > 0:
                inserted += 1
        self.conn.commit()
        return inserted

    def get_moments(
        self,
        session_id: str,
        *,
        kind: Optional[str] = None,
        min_confidence: float = 0.0,
    ) -> list[dict]:
        """Return key moments for a session, optionally filtered."""
        q = "SELECT * FROM key_moments WHERE session_id = ?"
        params: list = []
        if kind:
            q += " AND kind = ?"
            params.append(kind)
        q += " AND confidence >= ?"
        params.append(min_confidence)
        q += " ORDER BY seconds ASC"
        return [dict(r) for r in self.conn.execute(q, [session_id, *params]).fetchall()]

    # ── Sync from transcript file ──────────────────────────────────────────

    def sync_from_transcript_file(
        self,
        session_id: str,
        transcript_path: Path | str,
        *,
        min_moment_confidence: float = 0.7,
    ) -> dict:
        """Parse the live transcript file, persist new records and moments.

        Call this on every poll tick. It is idempotent — already-seen records
        are skipped via the UNIQUE constraint.

        Returns a summary dict::

            {
                "session_id": ...,
                "new_records": N,
                "new_moments": N,
                "total_records": N,
                "total_moments": N,
                "speakers": [...],
            }
        """
        path = Path(transcript_path)
        records = parse_transcript(path)
        moments = detect_moments(records, min_confidence=min_moment_confidence)

        new_records = self.insert_records(session_id, records)
        new_moments = self.insert_moments(session_id, moments)

        # Refresh counts.
        total_records = self.conn.execute(
            "SELECT COUNT(*) FROM transcript_records WHERE session_id = ?",
            (session_id,),
        ).fetchone()[0]
        total_moments = self.conn.execute(
            "SELECT COUNT(*) FROM key_moments WHERE session_id = ?",
            (session_id,),
        ).fetchone()[0]
        speakers = [
            r[0]
            for r in self.conn.execute(
                "SELECT DISTINCT speaker FROM transcript_records "
                "WHERE session_id = ? ORDER BY speaker",
                (session_id,),
            ).fetchall()
        ]

        self.update_session_stats(
            session_id,
            total_lines=total_records,
            total_moments=total_moments,
            speaker_count=len(speakers),
        )

        return {
            "session_id": session_id,
            "new_records": new_records,
            "new_moments": new_moments,
            "total_records": total_records,
            "total_moments": total_moments,
            "speakers": speakers,
        }


# -----------------------------------------------------------------------------
# Convenience singleton
# -----------------------------------------------------------------------------

_store: Optional[MeetingSessionStore] = None


def get_store() -> MeetingSessionStore:
    global _store
    if _store is None:
        _store = MeetingSessionStore()
    return _store