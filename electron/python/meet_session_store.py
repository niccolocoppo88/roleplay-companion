"""
meet_session_store — Electron shim.
Persists meeting sessions, transcript records, and key moments to SQLite.
Uses the same schema as the hermes-agent version but runs in the Electron context.
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
    created_at   REAL
);

CREATE INDEX IF NOT EXISTS idx_trec_session ON transcript_records(session_id);
CREATE INDEX IF NOT EXISTS idx_km_session  ON key_moments(session_id);
CREATE INDEX IF NOT EXISTS idx_km_kind     ON key_moments(kind);
"""


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
            _conn.executescript(_SCHEMA_SQL)
        return _conn


class MeetingSessionStore:
    def __init__(self, conn: Optional[sqlite3.Connection] = None):
        self._conn = conn

    @property
    def conn(self) -> sqlite3.Connection:
        return self._conn or _get_conn()

    def create_session(self, session_id: str, **kw) -> dict:
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
                kw.get('hermes_session_id'),
                kw.get('meeting_url', ''),
                kw.get('meeting_id', ''),
                kw.get('title', ''),
                kw.get('started_at') or now,
                kw.get('mode', 'transcribe'),
                kw.get('raw_transcript_path', ''),
                now,
            ),
        )
        self.conn.commit()
        return self.get_session(session_id) or {}

    def get_session(self, session_id: str) -> Optional[dict]:
        row = self.conn.execute(
            "SELECT * FROM meeting_sessions WHERE id = ?", (session_id,)
        ).fetchone()
        return dict(row) if row else None

    def update_session_stats(self, session_id: str, **kw) -> None:
        fields, vals = [], []
        for k, v in kw.items():
            if v is not None:
                snake = k.removeprefix('total_').lower()
                fields.append(f"{snake} = ?")
                vals.append(v)
        if not fields:
            return
        vals.append(session_id)
        self.conn.execute(
            f"UPDATE meeting_sessions SET {', '.join(fields)} WHERE id = ?",
            vals,
        )
        self.conn.commit()

    def end_session(self, session_id: str, status: str = "done", notes: str = "") -> None:
        self.update_session_stats(
            session_id,
            status=status,
            ended_at=time.time(),
            notes=notes,
        )

    def insert_records(self, session_id: str, records: list[TranscriptRecord]) -> int:
        now = time.time()
        inserted = 0
        for rec in records:
            try:
                ts_str = f"{rec.timestamp.hour:02d}:{rec.timestamp.minute:02d}:{rec.timestamp.second:02d}"
                self.conn.execute(
                    """
                    INSERT OR IGNORE INTO transcript_records
                        (session_id, timestamp, seconds, speaker, text, raw, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (session_id, ts_str, rec.seconds, rec.speaker, rec.text, rec.raw, now),
                )
                inserted += 1
            except Exception:
                pass
        self.conn.commit()
        return inserted

    def get_records(self, session_id: str, last: Optional[int] = None) -> list[dict]:
        q = "SELECT * FROM transcript_records WHERE session_id = ? ORDER BY seconds ASC"
        rows = self.conn.execute(q, (session_id,)).fetchall()
        result = [dict(r) for r in rows]
        if last:
            result = result[-last:]
        return result

    def insert_moments(self, session_id: str, moments: list[KeyMoment]) -> int:
        now = time.time()
        inserted = 0
        for m in moments:
            ts_str = f"{m.timestamp.hour:02d}:{m.timestamp.minute:02d}:{m.timestamp.second:02d}"
            cursor = self.conn.execute(
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
                    ts_str,
                    m.speaker,
                    m.text,
                    m.summary,
                    m.confidence,
                    m.triggered_on,
                    now,
                ),
            )
            if cursor.rowcount > 0:
                inserted += 1
        self.conn.commit()
        return inserted

    def get_moments(self, session_id: str, kind: Optional[str] = None, min_confidence: float = 0.0) -> list[dict]:
        q = "SELECT * FROM key_moments WHERE session_id = ?"
        params: list = []
        if kind:
            q += " AND kind = ?"
            params.append(kind)
        q += " AND confidence >= ?"
        params.append(min_confidence)
        q += " ORDER BY seconds ASC"
        return [dict(r) for r in self.conn.execute(q, [session_id, *params]).fetchall()]

    def sync_from_transcript_file(self, session_id: str, transcript_path: Path | str, *, min_moment_confidence: float = 0.7) -> dict:
        path = Path(transcript_path)
        records = parse_transcript(path)
        moments = detect_moments(records, min_confidence=min_moment_confidence)

        new_records = self.insert_records(session_id, records)
        new_moments = self.insert_moments(session_id, moments)

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
                "SELECT DISTINCT speaker FROM transcript_records WHERE session_id = ? ORDER BY speaker",
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


# ─── Module-level helpers for _pyCall ─────────────────────────────────────────

_store: Optional[MeetingSessionStore] = None


def get_store() -> MeetingSessionStore:
    global _store
    if _store is None:
        _store = MeetingSessionStore()
    return _store


def _session_create(fields: dict) -> dict:
    """Create a meeting session. Called via IPC from Electron."""
    store = get_store()
    return store.create_session(**fields)


def _session_get(fields: dict) -> Optional[dict]:
    store = get_store()
    session_id = fields.get('session_id')
    if not session_id:
        return None
    return store.get_session(session_id)


def _session_sync(fields: dict) -> dict:
    store = get_store()
    return store.sync_from_transcript_file(
        fields['session_id'],
        fields['transcript_path'],
        min_moment_confidence=fields.get('min_moment_confidence', 0.7),
    )


def _session_end(args: list) -> None:
    # args: [session_id] or [session_id, status] or [session_id, status, notes]
    store = get_store()
    session_id = args[0] if len(args) > 0 else None
    status = args[1] if len(args) > 1 else 'done'
    notes = args[2] if len(args) > 2 else ''
    if session_id:
        store.end_session(session_id, status=status, notes=notes)


def _create_session_wrapper(fields: dict) -> dict:
    return _session_create(fields)
