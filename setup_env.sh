#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="/opt/homebrew/opt/python@3.11/bin/python3.11"
VENV_PATH="${HOME}/.venvs/brainx"
TRIBEV2_DIR="${PROJECT_ROOT}/tribev2"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command brew
require_command git

if [[ ! -x "${PYTHON_BIN}" ]]; then
  echo "Installing python@3.11 via Homebrew..."
  brew install python@3.11
fi

mkdir -p "${HOME}/.venvs"

if [[ ! -d "${VENV_PATH}" ]]; then
  "${PYTHON_BIN}" -m venv "${VENV_PATH}"
fi

# shellcheck disable=SC1091
source "${VENV_PATH}/bin/activate"

python -m pip install --upgrade pip setuptools wheel
python -m pip install torch==2.6.0 torchvision==0.21.0

if [[ ! -d "${TRIBEV2_DIR}" ]]; then
  git clone https://github.com/facebookresearch/tribev2.git "${TRIBEV2_DIR}"
fi

python - <<'PY'
from pathlib import Path

root = Path("tribev2")
pyproject = root / "pyproject.toml"
model_py = root / "tribev2" / "model.py"

if not pyproject.exists():
    raise SystemExit("tribev2/pyproject.toml not found")

text = pyproject.read_text()
patched = text.replace('"numpy==2.2.6"', '"numpy>=2.2.6,<3"')
if text != patched:
    pyproject.write_text(patched)

model_text = model_py.read_text()
patched_model = model_text.replace("conv.requires_grad = False", "conv.requires_grad_(False)")
if model_text != patched_model:
    model_py.write_text(patched_model)
PY

python -m pip install -e "${TRIBEV2_DIR}[plotting]"
python -m pip install -r "${PROJECT_ROOT}/requirements.txt"

python - <<'PY'
import importlib
import torch

modules = ["tribev2", "fastapi", "sqlalchemy", "nilearn"]

print(f"Python: {torch.__file__}")
print(f"Torch version: {torch.__version__}")
print(f"MPS available: {torch.backends.mps.is_available()}")

for name in modules:
    importlib.import_module(name)
    print(f"Imported {name}")
PY
