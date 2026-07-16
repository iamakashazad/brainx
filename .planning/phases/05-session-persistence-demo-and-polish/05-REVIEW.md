---
phase: 05-session-persistence-demo-and-polish
reviewed: 2026-04-30T12:08:07Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - backend/core/config.py
  - backend/core/queue.py
  - backend/routers/analyze.py
  - backend/routers/jobs.py
  - backend/models/schemas.py
  - tests/test_jobs_list.py
  - tests/test_queue_guard.py
  - tests/test_watchdog.py
  - frontend/index.html
  - frontend/src/main.tsx
  - frontend/src/App.tsx
  - frontend/src/components/AppShell.tsx
  - frontend/src/components/ThemeToggle.tsx
  - frontend/src/components/design-system.tsx
  - frontend/src/stores/themeStore.ts
  - frontend/src/lib/api.ts
  - frontend/src/lib/errors.ts
  - frontend/src/lib/api-types.ts
  - frontend/src/lib/api-schemas.ts
  - frontend/src/lib/stageLabels.ts
  - frontend/src/features/history/HistoryView.tsx
  - frontend/src/features/history/SessionCard.tsx
  - frontend/src/features/history/DemoCard.tsx
  - frontend/src/features/history/DemoOverlay.tsx
  - frontend/src/features/history/useDemoResult.ts
  - frontend/src/features/history/useJobHistory.ts
  - frontend/src/features/results/ResultsLayout.tsx
  - frontend/src/features/results/SharedResultsPage.tsx
  - frontend/src/features/results/useActivation.ts
  - frontend/src/features/wizard/WizardShell.tsx
  - frontend/src/features/wizard/useSubmitAnalyze.ts
  - frontend/src/features/run/ProgressView.tsx
  - frontend/src/pages/DashboardPage.tsx
  - frontend/src/pages/ContentStepPage.tsx
  - frontend/src/pages/RunningPage.tsx
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
resolved_at: 2026-04-30T12:12:00Z
---

# Phase 05: Code Review Report

**Reviewed:** 2026-04-30T12:08:07Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** clean

## Summary

Reviewed the scoped backend queue/API changes, frontend session persistence and demo/result UI, and the new queue/history/watchdog tests. No critical security issues were found. The three original warnings were fixed by the orchestrator and the focused backend/type gates were rerun successfully.

## Resolved Warnings

### WR-01: Job status response no longer matches the frontend schema

**File:** `backend/routers/jobs.py:53`
**Issue:** `get_job_status()` returns `JobStatusResponse` without `persona_id`, but the frontend requires `persona_id` in `frontend/src/lib/api-schemas.ts:181`. Every `getJobStatus()` parse of `/jobs/{job_id}` can fail before the running/results screens can render, even when the backend request succeeds.
**Fix:** Keep the backend response model and frontend schema in sync. For example:

```python
class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    persona_id: Optional[str] = None
    queue_position: Optional[int] = None
    stage: Optional[str] = None
    result: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    created_at: Optional[str] = None
```

```python
return JobStatusResponse(
    job_id=job.id,
    status=job.status,
    persona_id=job.persona_id,
    queue_position=job.queue_position,
    stage=job.stage,
    result=job.result_json,
    error=job.error_message,
    created_at=job.created_at.isoformat() if job.created_at else None,
)
```

**Resolution:** `JobStatusResponse` and `get_job_status()` now include `persona_id`.

### WR-02: ProgressView conditionally skips hooks

**File:** `frontend/src/features/run/ProgressView.tsx:76`
**Issue:** `ProgressView` returns early for missing jobs and failure states before calling the `useState`/`useEffect` timer hooks at lines 100-109. When the same component instance moves between no job, running, and error states, React can throw a hook-order error such as "Rendered more/fewer hooks than during the previous render."
**Fix:** Move the elapsed timer hooks above all conditional returns and gate behavior inside the effect:

```tsx
const isRunning =
  jobQuery.data?.status === "RUNNING" || jobQuery.data?.status === "PENDING";
const [elapsed, setElapsed] = useState(0);

useEffect(() => {
  if (!isRunning) {
    setElapsed(0);
    return;
  }
  setElapsed(0);
  const id = setInterval(() => setElapsed((s) => s + 1), 1000);
  return () => clearInterval(id);
}, [isRunning]);

if (!jobId) {
  return null;
}
```

**Resolution:** `ProgressView` now declares the elapsed timer state/effect before early returns.

### WR-03: Queue depth guard is not atomic under concurrent submissions

**File:** `backend/routers/analyze.py:21`
**Issue:** The queue limit check happens before multiple awaited database operations, and the enqueue happens later at line 49. Concurrent requests can all observe `qsize() < QUEUE_DEPTH_LIMIT`, then each commit and enqueue, exceeding the intended depth limit.
**Fix:** Move capacity checking and enqueueing behind a single queue-manager function protected by an `asyncio.Lock`, or otherwise serialize the check/create/enqueue path. For example, validate persona/content first, then perform the final depth check and `put()` while holding a shared lock; if the queue is full at that point, return 503 before creating the job row.

**Resolution:** `queue_capacity_lock` now serializes the final queue check, job creation, and enqueue operation.

---

_Reviewed: 2026-04-30T12:08:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
