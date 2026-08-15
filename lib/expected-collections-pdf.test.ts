import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractExpectedCollectionRows } from "./expected-collections-pdf";

describe("extractExpectedCollectionRows", () => {
  it("reads rows from common envelopes", () => {
    const rows = extractExpectedCollectionRows({
      data: {
        items: [
          {
            loan_number: "LN-1",
            customer_name: "Asha",
            amount_due: 1000,
            due_date: "2026-08-01",
            status: "due",
            period_bucket: "this_month",
          },
        ],
      },
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].loan_number, "LN-1");
  });

  it("returns empty for unknown payloads", () => {
    assert.deepEqual(extractExpectedCollectionRows({ ok: true }), []);
  });
});
