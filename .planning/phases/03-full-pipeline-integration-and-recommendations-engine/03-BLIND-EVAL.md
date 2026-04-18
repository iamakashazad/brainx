---
phase: 03-full-pipeline-integration-and-recommendations-engine
recorded: 2026-04-18T11:00:49Z
status: fail
---

# Phase 03 Blind Eval Record

command: `DEEPSEEK_API_KEY=[REDACTED] ~/.venvs/brainx/bin/python -m pytest -q tests/test_recommendations_blind_eval.py::test_blind_eval_differentiates_opposite_profiles -s`
executed_at_utc: `2026-04-18T11:00:49Z`
git_sha: `25a6829fface7a45b2ee3d7a015dd3740ccedf8c`
deepseek_api_key_present: `true`
test_outcome: `FAIL`
jaccard_similarity: `unavailable`
recommendation_count_high: `unavailable`
recommendation_count_low: `unavailable`
cited_scores_verified: `unavailable`
valid_circuit_region_pairs: `unavailable`
verdict: `FAIL`

## Failure Reason

The live DeepSeek call executed successfully, but the returned recommendation bundle failed the 03-04 behavioral coverage validation before `BLIND_EVAL_METRICS=` could be emitted.

Observed validation failure:

`Recommendation bundle missing required behavioral coverage: layout_flag@screen_0, layout_flag@screen_2`

## Interpretation

- This is a real product gap, not a sandbox/network issue.
- The live model still omits required `layout_flag` outputs for trigger-heavy screens.
- Phase 03 therefore remains open until the recommendation service/prompt/model behavior can satisfy the enforced REC-02/03/04 coverage under live conditions.

## Evidence Notes

- The no-key path still passes as `1 passed, 1 skipped`.
- The live run reached DeepSeek and failed on local post-generation validation.
- No secret value was written to this artifact.
