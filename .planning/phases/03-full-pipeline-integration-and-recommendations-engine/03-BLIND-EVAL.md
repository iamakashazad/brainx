---
phase: 03-full-pipeline-integration-and-recommendations-engine
recorded: 2026-04-18T11:25:13Z
status: pass
---

# Phase 03 Blind Eval Record

command: `DEEPSEEK_API_KEY=[REDACTED] ~/.venvs/brainx/bin/python -m pytest -q tests/test_recommendations_blind_eval.py::test_blind_eval_differentiates_opposite_profiles -s`
executed_at_utc: `2026-04-18T11:25:13Z`
git_sha: `dba7554f1b1c53041767de7234a234591302ff93`
deepseek_api_key_present: `true`
test_outcome: `PASS`
jaccard_similarity: `0.2701`
recommendation_count_high: `6`
recommendation_count_low: `4`
cited_scores_verified: `true`
valid_circuit_region_pairs: `true`
verdict: `PASS`

## Outcome

The live DeepSeek call executed successfully and the updated recommendation service satisfied all blind-eval gates:

- opposite ROI profiles produced differentiated recommendation bundles
- every cited activation score matched the ROI bundles numerically
- every cited circuit/region pair resolved to a valid atlas label
- the trigger-heavy profile produced the required layout and behavioral coverage without tripping local validation

## Interpretation

- The earlier behavioral gap is now closed in live execution, not just mocked tests.
- The recommendations prompt and post-generation normalization are sufficient to keep the live model inside the Phase 03 evidence contract.
- Phase 03 no longer has an open blind-eval blocker on this path.

## Evidence Notes

- The no-key path still passes as `1 passed, 1 skipped`.
- The live keyed rerun passed with `BLIND_EVAL_METRICS={"cited_scores_verified": true, "jaccard_similarity": 0.2701, "recommendation_count_high": 6, "recommendation_count_low": 4, "valid_circuit_region_pairs": true}`.
- This record supersedes the earlier failed run from `2026-04-18T11:00:49Z`.
- No secret value was written to this artifact.
