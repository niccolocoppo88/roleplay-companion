"""Tests for meet_session_store — SQLite persistence for sessions/records/moments."""

import sqlite3
import tempfile
import time
from datetime import time as dt_time
from pathlib import Path

import pytest

# Stub hermes_constants before importing meet_session_store
import sys as _sys

_real_hermes_home = str(Path.home() / ".hermes")


class _FakeHermesConstants:
    @staticmethod
    def get_hermes_home():
        return Path(_real_hermes_home)


_sys.modules["hermes_constants"] = _FakeHermesConstants()

# Now import the modules under test
from meet_session_store import MeetingSessionStore
from meet_transcript_parser import TranscriptRecord, parse_transcript, parse_line
from meet_key_moments import KeyMoment, MomentKind, detect_moments


# ─── Helpers ─────────────────────────────────────────────────────────────────

def make_record(
    text: str,
    speaker: str = "Alice",
    seconds: int = 36000,
) -> TranscriptRecord:
    hh, rem = divmod(seconds, 3600)
    mm, ss = divmod(rem, 60)
    ts = dt_time(int(hh), int(mm), int(ss))
    return TranscriptRecord(
        timestamp=ts,
        raw=f"[{hh:02d}:{mm:02d}:{ss:02d}] {speaker}: {text}",
        speaker=speaker,
        text=text,
    )


def make_moment(
    kind: MomentKind,
    text: str,
    speaker: str = "Alice",
    seconds: int = 36000,
    confidence: float = 0.85,
) -> KeyMoment:
    hh, rem = divmod(seconds, 3600)
    mm, ss = divmod(rem, 60)
    ts = dt_time(int(hh), int(mm), int(ss))
    return KeyMoment(
        kind=kind,
        speaker=speaker,
        timestamp=ts,
        seconds=seconds,
        text=text,
        summary=text[:80],
        confidence=confidence,
        triggered_on="test",
    )


# ─── Test fixtures ────────────────────────────────────────────────────────────

@pytest.fixture
def conn():
    """Fresh in-memory SQLite connection with schema created."""
    c = sqlite3.connect(":memory:")
    import meet_session_store

    c.execute("PRAGMA foreign_keys=ON")
    c.row_factory = sqlite3.Row
    c.executescript(meet_session_store._SCHEMA_SQL)
    return c


@pytest.fixture
def store(conn):
    return MeetingSessionStore(conn=conn)


@pytest.fixture
def sample_transcript_file(tmp_path):
    """Write a small transcript file for integration tests."""
    content = "\n".join([
        "[10:00:00] Alice: Hi everyone, let's get started.",
        "[10:00:30] Bob: I'll share my screen.",
        "[10:01:15] Alice: Can we discuss the roadmap?",
        "[10:02:00] Bob: Yes, we agreed to ship by end of month.",
        "[10:03:00] Alice: Please update the README after the PR.",
        "[10:04:00] Charlie: What about the database migration?",
        "[10:05:00] Alice: That's a good point, important to test first.",
    ]) + "\n"
    p = tmp_path / "transcript.txt"
    p.write_text(content)
    return p


# ─── Session CRUD ─────────────────────────────────────────────────────────────

class TestSessionCrud:
    def test_create_session(self, store):
        s = store.create_session(
            "s1",
            hermes_session_id="h1",
            meeting_url="https://meet.google.com/abc",
            title="Weekly Standup",
            started_at=1000.0,
        )
        assert s["id"] == "s1"
        assert s["hermes_session_id"] == "h1"
        assert s["meeting_url"] == "https://meet.google.com/abc"
        assert s["title"] == "Weekly Standup"
        assert s["status"] == "active"
        assert s["total_lines"] == 0

    def test_get_session(self, store):
        store.create_session("s1", title="Test")
        s = store.get_session("s1")
        assert s is not None
        assert s["id"] == "s1"

    def test_get_session_not_found(self, store):
        assert store.get_session("nonexistent") is None

    def test_update_session_stats(self, store):
        store.create_session("s1")
        store.update_session_stats("s1", total_lines=10, total_moments=3, speaker_count=2)
        s = store.get_session("s1")
        assert s["total_lines"] == 10
        assert s["total_moments"] == 3
        assert s["speaker_count"] == 2

    def test_update_session_stats_incremental(self, store):
        store.create_session("s1")
        store.update_session_stats("s1", total_lines=5)
        store.update_session_stats("s1", total_moments=2)
        s = store.get_session("s1")
        assert s["total_lines"] == 5
        assert s["total_moments"] == 2

    def test_end_session(self, store):
        store.create_session("s1", started_at=1000.0)
        store.end_session("s1", status="done", notes="All good")
        s = store.get_session("s1")
        assert s["status"] == "done"
        assert s["ended_at"] is not None
        assert s["notes"] == "All good"

    def test_list_sessions(self, store):
        for i in range(5):
            store.create_session(f"s{i}", started_at=float(i))
        sessions = store.list_sessions(limit=3)
        assert len(sessions) == 3
        # most recent first
        assert sessions[0]["id"] == "s4"

    def test_list_sessions_filter_status(self, store):
        store.create_session("s1")
        store.create_session("s2")
        store.end_session("s1", status="done")
        active = store.list_sessions(status="active")
        assert len(active) == 1
        assert active[0]["id"] == "s2"


# ─── Transcript records ────────────────────────────────────────────────────────

class TestTranscriptRecords:
    def test_insert_records(self, store):
        store.create_session("s1")
        records = [
            make_record("Hello world", seconds=36000),
            make_record("Good morning", speaker="Bob", seconds=36010),
        ]
        n = store.insert_records("s1", records)
        assert n == 2
        rows = store.get_records("s1")
        assert len(rows) == 2
        assert rows[0]["speaker"] == "Alice"
        assert rows[1]["speaker"] == "Bob"

    def test_insert_records_idempotent(self, store):
        """UNIQUE constraint skips duplicates — verified by checking row count."""
        store.create_session("s1")
        records = [make_record("Hello", seconds=36000)]
        store.insert_records("s1", records)
        store.insert_records("s1", records)
        rows = store.get_records("s1")
        assert len(rows) == 1  # duplicate was skipped

    def test_insert_records_duplicate_different_session(self, store):
        """Same record text in different sessions is allowed."""
        store.create_session("s1")
        store.create_session("s2")
        records = [make_record("Hello", seconds=36000)]
        store.insert_records("s1", records)
        store.insert_records("s2", records)
        assert len(store.get_records("s1")) == 1
        assert len(store.get_records("s2")) == 1

    def test_get_records_tail(self, store):
        store.create_session("s1")
        records = [make_record(f"Line {i}", seconds=36000 + i * 10) for i in range(10)]
        store.insert_records("s1", records)
        tail = store.get_records("s1", last=3)
        assert len(tail) == 3
        assert tail[0]["text"] == "Line 7"
        assert tail[2]["text"] == "Line 9"

    def test_get_records_empty(self, store):
        store.create_session("s1")
        assert store.get_records("s1") == []


# ─── Key moments ─────────────────────────────────────────────────────────────

class TestKeyMoments:
    def test_insert_moments(self, store):
        store.create_session("s1")
        moments = [
            make_moment(MomentKind.DECISION, "We agreed to ship by end of month."),
            make_moment(MomentKind.ACTION_ITEM, "Please update the README."),
        ]
        n = store.insert_moments("s1", moments)
        assert n == 2
        rows = store.get_moments("s1")
        assert len(rows) == 2
        kinds = {r["kind"] for r in rows}
        assert kinds == {"decision", "action_item"}

    def test_insert_moments_idempotent(self, store):
        """UNIQUE+OR IGNORE skips duplicate moments."""
        store.create_session("s1")
        m = make_moment(MomentKind.QUESTION, "What about the migration?")
        store.insert_moments("s1", [m])
        store.insert_moments("s1", [m])
        rows = store.get_moments("s1")
        assert len(rows) == 1

    def test_get_moments_filter_kind(self, store):
        store.create_session("s1")
        moments = [
            make_moment(MomentKind.DECISION, "We agreed."),
            make_moment(MomentKind.ACTION_ITEM, "Please update docs."),
        ]
        store.insert_moments("s1", moments)
        decisions = store.get_moments("s1", kind="decision")
        assert len(decisions) == 1
        assert decisions[0]["kind"] == "decision"

    def test_get_moments_filter_min_confidence(self, store):
        store.create_session("s1")
        moments = [
            make_moment(MomentKind.IMPORTANT_POINT, "This is critical.", confidence=0.9),
            make_moment(MomentKind.IMPORTANT_POINT, "Something less certain.", confidence=0.5),
        ]
        store.insert_moments("s1", moments)
        high = store.get_moments("s1", min_confidence=0.8)
        assert len(high) == 1
        assert high[0]["confidence"] == 0.9

    def test_get_moments_combined_filter(self, store):
        store.create_session("s1")
        moments = [
            make_moment(MomentKind.QUESTION, "High confidence question?", confidence=0.9),
            make_moment(MomentKind.QUESTION, "Low confidence question.", confidence=0.4),
            make_moment(MomentKind.DECISION, "High confidence decision.", confidence=0.9),
        ]
        store.insert_moments("s1", moments)
        result = store.get_moments("s1", kind="question", min_confidence=0.8)
        assert len(result) == 1
        assert result[0]["kind"] == "question"

    def test_get_moments_empty(self, store):
        store.create_session("s1")
        assert store.get_moments("s1") == []


# ─── sync_from_transcript_file ────────────────────────────────────────────────

class TestSyncFromTranscriptFile:
    def test_sync_new_session(self, store, sample_transcript_file):
        store.create_session("s1")
        result = store.sync_from_transcript_file("s1", sample_transcript_file)
        assert result["session_id"] == "s1"
        assert result["new_records"] == 7
        assert result["total_records"] == 7
        assert result["total_moments"] >= 1
        assert "Alice" in result["speakers"]
        assert "Bob" in result["speakers"]
        assert "Charlie" in result["speakers"]

    def test_sync_idempotent(self, store, sample_transcript_file):
        """Second sync should see zero new records (UNIQUE constraint)."""
        store.create_session("s1")
        r1 = store.sync_from_transcript_file("s1", sample_transcript_file)
        r2 = store.sync_from_transcript_file("s1", sample_transcript_file)
        assert r2["new_records"] == 0
        assert r2["total_records"] == r1["total_records"]

    def test_sync_updates_session_stats(self, store, sample_transcript_file):
        store.create_session("s1")
        store.sync_from_transcript_file("s1", sample_transcript_file)
        s = store.get_session("s1")
        assert s["total_lines"] == 7
        assert s["speaker_count"] == 3
        assert s["total_moments"] >= 1

    def test_sync_nonexistent_file(self, store):
        """Must not raise — parse_transcript returns [] for missing files."""
        store.create_session("s1")
        result = store.sync_from_transcript_file("s1", Path("/nonexistent/file.txt"))
        assert result["new_records"] == 0
        assert result["total_records"] == 0


# ─── Integration: parser → moments → store ───────────────────────────────────

class TestFullIntegration:
    def test_parse_detect_store_retrieve(self, store, sample_transcript_file):
        # 1. Parse the transcript file
        records = parse_transcript(sample_transcript_file)
        assert len(records) == 7
        assert all(isinstance(r, TranscriptRecord) for r in records)

        # 2. Detect key moments
        moments = detect_moments(records, min_confidence=0.7)
        assert len(moments) >= 1
        assert all(isinstance(m, KeyMoment) for m in moments)

        # 3. Persist
        store.create_session("s1")
        store.insert_records("s1", records)
        n_moments = store.insert_moments("s1", moments)

        # 4. Retrieve and verify
        retrieved_records = store.get_records("s1")
        retrieved_moments = store.get_moments("s1")
        assert len(retrieved_records) == 7
        assert len(retrieved_moments) == n_moments

    def test_moments_sorted_chronologically(self, store, sample_transcript_file):
        store.create_session("s1")
        store.sync_from_transcript_file("s1", sample_transcript_file)
        moments = store.get_moments("s1")
        seconds = [m["seconds"] for m in moments]
        assert seconds == sorted(seconds)


# ─── Smoke tests for helper functions ────────────────────────────────────────

class TestHelperFunctions:
    def test_format_moments_as_text(self):
        moments = [
            make_moment(MomentKind.DECISION, "We agreed to ship the MVP.", seconds=36000),
            make_moment(MomentKind.ACTION_ITEM, "Please update the README.", seconds=36060),
        ]
        from meet_key_moments import format_moments_as_text
        text = format_moments_as_text(moments)
        assert "We agreed to ship the MVP" in text
        assert "update the README" in text

    def test_group_moments_by_kind(self):
        moments = [
            make_moment(MomentKind.DECISION, "Decision 1"),
            make_moment(MomentKind.DECISION, "Decision 2"),
            make_moment(MomentKind.ACTION_ITEM, "Action 1"),
        ]
        from meet_key_moments import group_moments_by_kind
        grouped = group_moments_by_kind(moments)
        assert len(grouped[MomentKind.DECISION]) == 2
        assert len(grouped[MomentKind.ACTION_ITEM]) == 1
        assert len(grouped[MomentKind.QUESTION]) == 0

    def test_get_speaker_stats(self):
        from meet_transcript_parser import get_speaker_stats
        records = [
            make_record("Hello world", speaker="Alice", seconds=36000),
            make_record("Good morning", speaker="Alice", seconds=36010),
            make_record("Hi there", speaker="Bob", seconds=36020),
        ]
        stats = get_speaker_stats(records)
        assert stats["Alice"]["utterances"] == 2
        assert stats["Bob"]["utterances"] == 1
        assert stats["Alice"]["words"] == 4  # hello(1) world(1) good(1) morning(1)

    def test_parse_line_empty_text(self):
        """Blank caption lines (empty text) parse successfully."""
        rec = parse_line("[14:32:07] Alice:")
        assert rec is not None
        assert rec.speaker == "Alice"
        assert rec.text == ""

    def test_parse_transcript_tail(self, tmp_path):
        """max_lines=N reads only the last N lines."""
        lines = "\n".join(f"[10:{i:02d}:00] Alice: Line {i}" for i in range(20)) + "\n"
        p = tmp_path / "transcript.txt"
        p.write_text(lines)
        records = parse_transcript(p, max_lines=5)
        assert len(records) == 5
        assert records[0].text == "Line 15"
        assert records[4].text == "Line 19"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])