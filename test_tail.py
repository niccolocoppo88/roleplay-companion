#!/usr/bin/env python3
import sys
sys.path.insert(0, 'electron/python')

from meet_transcript_parser import parse_transcript
from pathlib import Path
import tempfile

with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
    for i in range(20):
        f.write(f'[10:{i:02d}:00] Alice: Line {i}\n')
    path = Path(f.name)

try:
    records = parse_transcript(path, max_lines=5)
    print(f'Got {len(records)} records')
    for r in records:
        print(f'  {r.text}')
except Exception as e:
    import traceback
    print(f'ERROR: {type(e).__name__}: {e}')
    traceback.print_exc()