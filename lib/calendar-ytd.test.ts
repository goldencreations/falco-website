import assert from "node:assert/strict";
import { it } from "node:test";
import { calendarYtdQuarters } from "./financial-statements";

it("shows the cumulative quarters through the selected quarter", () => {
  for (const [quarter, label] of [[1, "Q1"], [2, "Q1 + Q2"], [3, "Q1 + Q2 + Q3"], [4, "Q1 + Q2 + Q3 + Q4"]] as const) {
    assert.equal(calendarYtdQuarters(quarter), label);
  }
});
