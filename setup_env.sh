#!/usr/bin/env bash
# One-time backend setup: Python 3.11 venv, PyTorch, a pinned TRIBEv2 clone
# with BrainX's local patch applied, and the backend requirements.
#
# Overridable via environment:
#   BRAINX_PYTHON   Python 3.11 interpreter to build the venv from
#                   (default: python3.11 on PATH, else Homebrew's python@3.11)
#   BRAINX_VENV     venv location (default: ~/.venvs/brainx)
#
# Safe to re-run: existing venv, clone and patch are detected and reused.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PATH="${BRAINX_VENV:-${HOME}/.venvs/brainx}"
TRIBEV2_DIR="${PROJECT_ROOT}/tribev2"
TRIBEV2_REPO="https://github.com/facebookresearch/tribev2.git"
# patches/tribev2.patch is written against this upstream commit.
TRIBEV2_COMMIT="72399081ed3f1040c4d996cefb2864a4c46f5b8e"
TRIBEV2_PATCH="${PROJECT_ROOT}/patches/tribev2.patch"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1. $2" >&2
    exit 1
  fi
}

require_command git "Install git first."
# TRIBEv2 transcribes speech by shelling out to `uvx whisperx`.
require_command uvx "Install uv: https://docs.astral.sh/uv/getting-started/installation/"

resolve_python() {
  if [[ -n "${BRAINX_PYTHON:-}" ]]; then
    echo "${BRAINX_PYTHON}"
  elif command -v python3.11 >/dev/null 2>&1; then
    command -v python3.11
  elif [[ -x /opt/homebrew/opt/python@3.11/bin/python3.11 ]]; then
    echo /opt/homebrew/opt/python@3.11/bin/python3.11
  elif command -v brew >/dev/null 2>&1; then
    echo "Installing python@3.11 via Homebrew..." >&2
    brew install python@3.11 >&2
    echo "$(brew --prefix python@3.11)/bin/python3.11"
  else
    echo "Python 3.11 not found. Install it (or uv: 'uv python install 3.11') and set BRAINX_PYTHON." >&2
    exit 1
  fi
}

PYTHON_BIN="$(resolve_python)"
if ! "${PYTHON_BIN}" -c 'import sys; sys.exit(0 if sys.version_info[:2] == (3, 11) else 1)'; then
  echo "${PYTHON_BIN} is not Python 3.11" >&2
  exit 1
fi

if [[ ! -d "${VENV_PATH}" ]]; then
  mkdir -p "$(dirname "${VENV_PATH}")"
  "${PYTHON_BIN}" -m venv "${VENV_PATH}"
fi

# shellcheck disable=SC1091
source "${VENV_PATH}/bin/activate"

python -m pip install --upgrade pip setuptools wheel
python -m pip install torch==2.6.0 torchvision==0.21.0

if [[ ! -d "${TRIBEV2_DIR}" ]]; then
  git clone "${TRIBEV2_REPO}" "${TRIBEV2_DIR}"
  git -C "${TRIBEV2_DIR}" checkout --quiet "${TRIBEV2_COMMIT}"
fi

if git -C "${TRIBEV2_DIR}" apply --reverse --check "${TRIBEV2_PATCH}" >/dev/null 2>&1; then
  echo "TRIBEv2 patch already applied."
elif git -C "${TRIBEV2_DIR}" apply --check "${TRIBEV2_PATCH}" >/dev/null 2>&1; then
  git -C "${TRIBEV2_DIR}" apply "${TRIBEV2_PATCH}"
  echo "Applied patches/tribev2.patch."
else
  echo "patches/tribev2.patch does not apply to ${TRIBEV2_DIR}." >&2
  echo "Expected a clean checkout of ${TRIBEV2_COMMIT}; see patches/tribev2-changes.md." >&2
  exit 1
fi

python -m pip install -e "${TRIBEV2_DIR}[plotting]"
python -m pip install -r "${PROJECT_ROOT}/requirements.txt"

python - <<'PY'
import importlib
import torch

modules = ["tribev2", "fastapi", "sqlalchemy", "nilearn", "magic"]

print(f"Torch version: {torch.__version__}")
for name in modules:
    importlib.import_module(name)
    print(f"Imported {name}")
PY

echo
echo "Done. Backend Python: ${VENV_PATH}/bin/python"
echo "Next: cp .env.example .env and fill in DEEPSEEK_API_KEY, HF_TOKEN (and REPLICATE_API_TOKEN for images)."
