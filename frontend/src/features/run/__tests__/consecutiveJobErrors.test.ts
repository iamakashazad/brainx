import { describe, expect, it } from "vitest";
import { consecutiveJobErrors, isJobPollingStopped } from "../useJobStatus";

describe("consecutiveJobErrors", () => {
  it("resets after a successful fetch, so scattered blips never stop polling", () => {
    const id = "job-blips";
    // Two failed cycles, then a success, then one more failure: errorUpdateCount
    // is 3 in total but only 1 is consecutive.
    expect(consecutiveJobErrors(id, { errorUpdateCount: 2, error: new Error("x") })).toBe(2);
    expect(consecutiveJobErrors(id, { errorUpdateCount: 2, error: null })).toBe(0);
    expect(consecutiveJobErrors(id, { errorUpdateCount: 3, error: new Error("x") })).toBe(1);
    expect(
      isJobPollingStopped(id, {
        status: "RUNNING",
        errorUpdateCount: 3,
        error: new Error("x"),
        isFetching: false,
      }),
    ).toBe(false);
  });

  it("stops polling after 3 consecutive failed cycles", () => {
    const id = "job-down";
    expect(
      isJobPollingStopped(id, {
        status: "RUNNING",
        errorUpdateCount: 3,
        error: new Error("down"),
        isFetching: false,
      }),
    ).toBe(true);
  });

  it("is not stopped while a refetch is in flight", () => {
    expect(
      isJobPollingStopped("job-fetching", {
        status: undefined,
        errorUpdateCount: 5,
        error: new Error("down"),
        isFetching: true,
      }),
    ).toBe(false);
  });
});
