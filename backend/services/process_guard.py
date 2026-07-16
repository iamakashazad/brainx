from __future__ import annotations

import os
import signal
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


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
    """Terminate stale WhisperX subprocesses that cannot be tracked by the worker queue."""
    keep = tuple(token for token in keep_tokens if token)
    killed = 0
    for process in list_workspace_whisperx_processes():
        if any(token in process.command for token in keep):
            continue
        try:
            os.kill(process.pid, signal.SIGTERM)
            killed += 1
        except ProcessLookupError:
            continue
        except PermissionError:
            continue

    return killed


def workspace_whisperx_count() -> int:
    return len(list_workspace_whisperx_processes())
