---
phase: 01-foundation-and-tribev2-integration
plan: 01
subsystem: infra
tags: [python, tribev2, torch, mps, bootstrap]
requires: []
provides:
  - Python 3.11 venv at ~/.venvs/brainx with TRIBEv2 installed
  - Backend package skeleton, settings contract, and loader contract
  - Environment verification tests for Phase 1 foundations
affects: [api, inference, queue, roi]
tech-stack:
  added: [python@3.11, torch, torchvision, tribev2, fastapi, sqlalchemy]
  patterns: [local venv bootstrap, lazy model loading contract]
key-files:
  created: [setup_env.sh, requirements.txt, backend/core/config.py, backend/ml/tribe_loader.py, tests/test_env.py]
  modified: [requirements.txt, backend/ml/tribe_loader.py]
key-decisions:
  - "Used ~/.venvs/brainx instead of conda to match the machine and plan research."
  - "Patched TRIBEv2 install-time issues in setup_env.sh before package installation."
patterns-established:
  - "Environment bootstrap lives in setup_env.sh and is rerunnable."
  - "Runtime settings are loaded from .env via pydantic-settings."
requirements-completed: [INFRA-01]
duration: 2026-04-11 session
completed: 2026-04-11
---

# Phase 01 Plan 01 Summary

**Python 3.11/MPS TRIBEv2 bootstrap with reproducible setup script, backend config contract, and environment verification tests**

## Performance

- **Duration:** 2026-04-11 session
- **Started:** 2026-04-11T15:30:35Z
- **Completed:** 2026-04-11T18:20:00Z
- **Tasks:** 2
- **Files modified:** 6 committed files plus local `.env`

## Accomplishments
- Built a rerunnable `setup_env.sh` that installs Python 3.11, creates `~/.venvs/brainx`, clones and patches TRIBEv2, and verifies core imports.
- Added the initial backend package layout, environment-driven settings module, and TRIBEv2 loader contract used by later plans.
- Verified the real environment with `pytest tests/test_env.py`, including Python 3.11, Torch 2.6, MPS availability, and dependency imports.

## Task Commits

1. **Task 1: Create venv/bootstrap files** - `792df17` (`chore`)
2. **Task 2: Create backend skeleton + env tests** - `c284b51` (`feat`)

Additional runtime fixes:
- `13dc6e6` - dependency pin conflict fix for `moviepy`/`Pillow`
- `84a0472` - loader fix for actual `tribev2.demo_utils.TribeModel` runtime behavior

## Files Created/Modified
- `setup_env.sh` - Reproducible environment bootstrap and TRIBEv2 patch application
- `requirements.txt` - Direct dependency pins aligned with the working TRIBEv2 environment
- `backend/core/config.py` - Settings model for device, cache path, and DB URL
- `backend/ml/tribe_loader.py` - Lazy singleton model loader adapted to the real TRIBEv2 import path
- `tests/test_env.py` - Environment verification tests

## Decisions Made
- Used the real upstream `TribeModel` import path from `tribev2.demo_utils` rather than assuming a package-root export.
- Redirected TRIBEv2/neuralset cache writes into `model_cache/` to avoid blocked home-directory writes in this environment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Resolved dependency pin conflict in Phase 1 environment**
- **Found during:** Task 1 (environment bootstrap)
- **Issue:** `moviepy==2.1.2` required `Pillow<11`, which conflicted with the installed scientific/image stack.
- **Fix:** Updated `requirements.txt` to the versions that actually resolved and passed installation in the working TRIBEv2 environment.
- **Files modified:** `requirements.txt`
- **Verification:** `./setup_env.sh` completed successfully and core imports passed
- **Committed in:** `13dc6e6`

**2. [Rule 3 - Blocking] Corrected TRIBEv2 loader assumptions from upstream runtime**
- **Found during:** Phase 1 integration smoke tests
- **Issue:** The model class is not exported from `tribev2` root and does not expose `.eval()`.
- **Fix:** Updated the loader to import from `tribev2.demo_utils`, redirect caches locally, and remove the invalid `.eval()` call.
- **Files modified:** `backend/ml/tribe_loader.py`
- **Verification:** Fast suite still passed after the loader change and model loading advanced past the earlier import/cache failures
- **Committed in:** `84a0472`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were required to make the bootstrap work against the real upstream package and local environment.

## Issues Encountered
- TRIBEv2 and its dependencies write caches outside the repo by default; local cache redirection was required in this environment.

## User Setup Required

None - the local `.env` and `setup_env.sh` cover the Phase 1 environment bootstrap.

## Next Phase Readiness
- Ready for backend API and queue work.
- Real TRIBEv2 model loading now reaches the checkpoint/inference stage instead of failing immediately on imports.

---
*Phase: 01-foundation-and-tribev2-integration*
*Completed: 2026-04-11*
