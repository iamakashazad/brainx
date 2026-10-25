# Contributing to BrainX

Thanks for your interest. BrainX is a research preview maintained in spare
time, so small, focused changes are the easiest to review and merge.

## Before you start

- For anything bigger than a bug fix, open an issue first so we can agree on
  the approach.
- Read [CLAUDE.md](CLAUDE.md) for the architecture and the queue's resilience
  invariants. Changes that weaken those (for example, a worker failure path
  that can leave a job stuck) will not be merged.
- By contributing you agree that your code is licensed under the
  [MIT License](LICENSE). Changes to `patches/tribev2.patch` modify TRIBEv2 and
  fall under its CC BY-NC 4.0 licence (see [NOTICE](NOTICE)).

## Development setup

Follow [Setup](README.md#setup) in the README. You do not need real API keys or
model downloads to work on most of the code: the backend tests fake TRIBEv2
and use dummy keys, and the frontend can run against mocks with
`VITE_USE_MSW=1 npm run dev`.

## Checks

Run these before opening a pull request. CI runs the same ones.

```bash
# Backend (from the repo root, with the backend venv's Python)
python -m pytest tests/ -q

# Frontend (from frontend/)
npx tsc -b --force
npx vitest run
```

Please add or update tests for behaviour changes. When changing the API, keep
`frontend/src/lib/api-schemas.ts` in sync with `backend/models/schemas.py`.

## Changing TRIBEv2

`tribev2/` is a pinned upstream clone that `setup_env.sh` patches. If you need
to change it, edit the files in `tribev2/`, then regenerate the patch and
document why:

```bash
git -C tribev2 diff > patches/tribev2.patch
# then explain the change in patches/tribev2-changes.md
```

## Pull requests

- Keep each PR to one logical change, with a clear description of what and why.
- Never commit `.env`, `brainx.db`, `uploads/`, `activations/`, `model_cache/`
  or `tribev2/`; they are gitignored for a reason.
- Be kind in reviews and discussions. See the
  [Code of Conduct](CODE_OF_CONDUCT.md).
