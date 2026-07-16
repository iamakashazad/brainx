import type { JobStatus, StageValue } from "./api-types";

/**
 * Display copy from the Phase 4 UI contract. Do not paraphrase.
 */
export const DISPLAY_QUEUED = "Queued";
export const DISPLAY_SIMULATING =
  "Simulating how your persona experiences this content…";
export const DISPLAY_INFERRING = "Running brain inference…";
export const DISPLAY_AGGREGATING = "Aggregating results…";
export const DISPLAY_COMPLETE = "Analysis complete";
export const DISPLAY_FAILED_HEADING = "Analysis failed";
export const DISPLAY_FAILED_BODY =
  "Something went wrong during brain inference. Check that your content uploaded correctly, then try again.";
export const DISPLAY_TIMEOUT_BODY =
  "Analysis timed out before it finished. Please try again — shorter content may process faster.";
export const DISPLAY_INTERRUPTED_BODY =
  "Analysis was interrupted before it finished. Start a new analysis to run it again.";

/**
 * Ordered display stages for the run indicator. Terminal states stay display-only.
 */
export const stageOrder = [
  DISPLAY_QUEUED,
  DISPLAY_SIMULATING,
  DISPLAY_INFERRING,
  DISPLAY_AGGREGATING,
] as const;

export type DisplayStage = (typeof stageOrder)[number];

/**
 * Map backend stage/status values to the user-facing progress copy.
 */
export function displayStage(
  stage: StageValue | null | undefined,
  status: JobStatus,
): string {
  if (status === "DONE") {
    return DISPLAY_COMPLETE;
  }

  if (status === "PENDING" || stage === null || stage === undefined) {
    return DISPLAY_QUEUED;
  }

  switch (stage) {
    case "simulation":
    case "grounding_check":
      return DISPLAY_SIMULATING;
    case "inference":
    case "roi_aggregation":
      return DISPLAY_INFERRING;
    case "processing":
    case "recommendations":
      return DISPLAY_AGGREGATING;
    default:
      return DISPLAY_QUEUED;
  }
}

/**
 * Index of the current display stage within stageOrder for steppers/progress UI.
 */
export function displayStageIndex(
  stage: StageValue | null | undefined,
  status: JobStatus,
): number {
  const label = displayStage(stage, status);
  const index = stageOrder.indexOf(label as DisplayStage);
  return index >= 0 ? index : 0;
}

/**
 * Display-only status label for headings/badges. Backend types remain unchanged.
 */
export function displayStatusForStage(status: JobStatus): string {
  if (status === "DONE") {
    return "COMPLETE";
  }

  if (status === "ERROR") {
    return "FAILED";
  }

  if (status === "PENDING") {
    return "PENDING";
  }

  return "RUNNING";
}

export function displayFailureBodyFor(errorMessage: string | null | undefined): string {
  const normalizedError = errorMessage?.toLowerCase() ?? "";

  if (normalizedError.includes("timed out")) {
    return DISPLAY_TIMEOUT_BODY;
  }

  if (normalizedError.includes("interrupted")) {
    return DISPLAY_INTERRUPTED_BODY;
  }

  return DISPLAY_FAILED_BODY;
}
