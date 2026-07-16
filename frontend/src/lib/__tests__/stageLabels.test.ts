import { describe, expect, it } from "vitest";
import * as stageLabels from "../stageLabels";
import {
  DISPLAY_AGGREGATING,
  DISPLAY_COMPLETE,
  DISPLAY_FAILED_BODY,
  DISPLAY_FAILED_HEADING,
  DISPLAY_INFERRING,
  DISPLAY_QUEUED,
  DISPLAY_SIMULATING,
  DISPLAY_TIMEOUT_BODY,
  displayFailureBodyFor,
  displayStage,
  displayStatusForStage,
  stageOrder,
} from "../stageLabels";

describe("stageLabels", () => {
  it("returns Queued for a pending job with no stage", () => {
    expect(displayStage(null, "PENDING")).toBe(DISPLAY_QUEUED);
  });

  it("maps simulation to the simulating display copy", () => {
    expect(displayStage("simulation", "RUNNING")).toBe(DISPLAY_SIMULATING);
  });

  it("folds grounding_check into the simulating display copy", () => {
    expect(displayStage("grounding_check", "RUNNING")).toBe(DISPLAY_SIMULATING);
  });

  it("maps inference to the inferring display copy", () => {
    expect(displayStage("inference", "RUNNING")).toBe(DISPLAY_INFERRING);
  });

  it("folds roi_aggregation into the inferring display copy", () => {
    expect(displayStage("roi_aggregation", "RUNNING")).toBe(DISPLAY_INFERRING);
  });

  it("maps processing to the aggregating display copy", () => {
    expect(displayStage("processing", "RUNNING")).toBe(DISPLAY_AGGREGATING);
  });

  it("folds recommendations into the aggregating display copy", () => {
    expect(displayStage("recommendations", "RUNNING")).toBe(DISPLAY_AGGREGATING);
  });

  it("returns Analysis complete for a done job", () => {
    expect(displayStage(null, "DONE")).toBe(DISPLAY_COMPLETE);
  });

  it("maps done and error to display-only terminal labels", () => {
    expect(displayStatusForStage("DONE")).toBe("COMPLETE");
    expect(displayStatusForStage("ERROR")).toBe("FAILED");
  });

  it("exposes the ordered display stages and the failure copy constants", () => {
    expect(stageOrder).toEqual([
      DISPLAY_QUEUED,
      DISPLAY_SIMULATING,
      DISPLAY_INFERRING,
      DISPLAY_AGGREGATING,
    ]);
    expect(DISPLAY_FAILED_HEADING).toBe("Analysis failed");
    expect(DISPLAY_FAILED_BODY).toBe(
      "Something went wrong during brain inference. Check that your content uploaded correctly, then try again.",
    );
  });

  it("defensively defaults unknown running values and avoids backend COMPLETE or FAILED exports", () => {
    expect(displayStage(undefined as never, "RUNNING")).toBe(DISPLAY_QUEUED);
    expect("COMPLETE" in stageLabels).toBe(false);
    expect("FAILED" in stageLabels).toBe(false);

    // @ts-expect-error backend stages stay snake_case, never UI copy aliases
    displayStage("simulating", "RUNNING");
  });

  it("returns timeout failure copy for timed-out jobs", () => {
    expect(displayFailureBodyFor("Job timed out after 600 seconds")).toBe(DISPLAY_TIMEOUT_BODY);
  });

  it("returns default failure copy for non-timeout errors", () => {
    expect(displayFailureBodyFor(null)).toBe(DISPLAY_FAILED_BODY);
    expect(displayFailureBodyFor("Inference failed")).toBe(DISPLAY_FAILED_BODY);
  });
});
