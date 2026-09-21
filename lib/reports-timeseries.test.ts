import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPeriodRange } from "./reports-timeseries";

describe("getPeriodRange", () => {
  it("preserves exact custom calendar dates without a UTC day shift", () => {
    assert.deepEqual(getPeriodRange("1m", "2026-08-01", "2026-08-31"), {
      from: "2026-08-01",
      to: "2026-08-31",
      label: "Custom (2026-08-01 to 2026-08-31)",
    });
  });

  it("keeps an end-only custom date unchanged", () => {
    const range = getPeriodRange("1m", undefined, "2026-08-01");

    assert.equal(range.to, "2026-08-01");
    assert.match(range.label, /to 2026-08-01\)$/);
  });
});
