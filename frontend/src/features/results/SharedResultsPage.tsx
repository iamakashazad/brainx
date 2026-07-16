import { Link, useParams } from "react-router-dom";
import { Button, Surface } from "@/components/design-system";
import { useJobStatus } from "@/features/run/useJobStatus";
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
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <Surface className="max-w-xl p-8 text-center">
          <h1 className="text-3xl font-semibold" style={{ color: "var(--foreground)" }}>
            Session not found
          </h1>
          <p className="mt-3 text-base leading-7" style={{ color: "var(--muted-foreground)" }}>
            Session not found. This analysis may have been deleted or the link is incorrect.
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
