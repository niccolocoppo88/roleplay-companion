"""
hermes_constants shim for the Electron main process context.
Overrides the real hermes-agent/hermes_constants so meet_session_store
works without depending on the full hermes-agent environment.

The real get_hermes_home() from hermes_constants returns:
  Path(os.environ.get('HERMES_HOME', '~/.hermes'))

We mirror that behaviour so session store paths are stable.
"""
import os
from pathlib import Path

def get_hermes_home() -> Path:
    return Path(os.environ.get('HERMES_HOME', str(Path.home() / '.hermes')))
