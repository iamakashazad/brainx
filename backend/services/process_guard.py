from __future__ import annotations

import logging
import os
import signal
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ProcessSnapshot:
    pid: int
    command: str


def _workspace_marker() -> str:
    return str(Path.cwd() / "model_cache")


def list_workspace_whisperx_processes() -> list[ProcessSnapshot]:
    """Return WhisperX subprocesses launched for this workspace's model cache."""
    try:
        result = subprocess.run(
            ["pgrep", "-fl", "whisperx"],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.TimeoutExpired):
        return []

    marker = _workspace_marker()
    processes: list[ProcessSnapshot] = []
    for line in result.stdout.splitlines():
        pid_text, _, command = line.partition(" ")
        if not pid_text.isdigit():
            continue
        if marker not in command:
            continue
        processes.append(ProcessSnapshot(pid=int(pid_text), command=command))

    return processes


def cleanup_workspace_whisperx_processes(keep_tokens: Iterable[str] = ()) -> int:
    """Terminate stale WhisperX subprocesses that cannot be tracked by the worker queue.

    This matches on `pgrep -f whisperx` output, so it cannot itself distinguish a
    stale child from one the current job depends on. Every call site is safe only
    because of *when* it runs, and each kill is logged because a silent SIGTERM
    here is indistinguishable from an external one and previously cost a long
    investigation (see patches/tribev2-eventstransforms-cpu-fixes.patch, Change 4):

    - backend/main.py (startup): nothing of ours is running yet.
    - queue.py cancel_and_delete_job: killing the job's own whisperx is the point.
    - queue.py INFERENCE transition: runs before this job spawns any whisperx, so
      every match is by definition left over from an earlier run.

    `keep_tokens` spares processes whose command line contains any given token.
    No current caller passes it; if you add a call site that can overlap a live
    transcription, you must pass one.
    """
    keep = tuple(token for token in keep_tokens if token)
    killed = 0
    for process in list_workspace_whisperx_processes():
        if any(token in process.command for token in keep):
            logger.info("keeping whisperx pid %s (matched keep token)", process.pid)
            continue
        try:
            os.kill(process.pid, signal.SIGTERM)
            killed += 1
            logger.warning(
                "sent SIGTERM to workspace whisperx pid %s: %s",
                process.pid,
                process.command,
            )
        except ProcessLookupError:
            continue
        except PermissionError:
            logger.warning("not permitted to signal whisperx pid %s", process.pid)
            continue

    return killed


def workspace_whisperx_count() -> int:
    return len(list_workspace_whisperx_processes())
