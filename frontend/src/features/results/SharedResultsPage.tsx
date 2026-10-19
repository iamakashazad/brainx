import { Link, useParams } from "react-router-dom";
import { Button, Surface } from "@/components/design-system";
import { useJobStatus } from "@/features/run/useJobStatus";
import { ApiError } from "@/lib/errors";
import { ResultsLayout } from "./ResultsLayout";

export function SharedResultsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const jobQuery = useJobStatus(jobId ?? null);

  if (!jobId) {
    return null;
  }

  if (jobQuery.isLoading) {
    return (
      <div className="px-6 py-10">
        <Surface className="mx-auto max-w-3xl p-8">
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Loading shared analysis…
          </p>
        </Surface>
      </div>
    );
  }

  if (jobQuery.isError || !jobQuery.data?.result) {
    // Only a 404 means "not found"; a running, failed, or unreachable job used
    // to be reported as deleted too.
    const job = jobQuery.data;
    let title = "Session not found";
    let body = "This analysis may have been deleted or the link is incorrect.";
    if (job?.status === "PENDING" || job?.status === "RUNNING") {
      title = "Analysis still running";
      body = "This analysis has not finished yet. Reload this page in a few minutes.";
    } else if (job?.status === "ERROR") {
      title = "Analysis failed";
      body = job.error ?? "This analysis did not complete.";
    } else if (jobQuery.isError && !(jobQuery.error instanceof ApiError && jobQuery.error.status === 404)) {
      title = "Could not load this session";
      body = jobQuery.error.message;
    }
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <Surface className="max-w-xl p-8 text-center">
          <h1 className="text-3xl font-semibold" style={{ color: "var(--foreground)" }}>
            {title}
          </h1>
          <p className="mt-3 text-base leading-7" style={{ color: "var(--muted-foreground)" }}>
            {body}
          </p>
          <div className="mt-6 flex justify-center">
            <Link to="/">
              <Button variant="primary">Go to History</Button>
            </Link>
          </div>
        </Surface>
      </div>
    );
  }

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <ResultsLayout resultOverride={jobQuery.data.result} jobIdOverride={jobId} />
      </div>
    </div>
  );
}
