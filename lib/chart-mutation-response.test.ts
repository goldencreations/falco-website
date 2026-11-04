import assert from "node:assert/strict";
import { it } from "node:test";
import { readChartMutationResponse } from "./chart-mutation-response";

it("shows deletion validation in plain language without field names", async () => {
  await assert.rejects(readChartMutationResponse(Response.json({ message: "Validation failed", errors: { node: ["Cannot delete because it contains a record."] } }, { status: 422 })), { message: "Cannot delete because it contains a record." });
});
it("replaces HTML and malformed responses with a friendly service message", async () => {
  for (const body of ["<html><h1>Bad Gateway</h1></html>", "not JSON", "null"]) {
    await assert.rejects(readChartMutationResponse(new Response(body, { status: 502 })), { message: "The General Ledger service could not complete this request. Please try again." });
  }
});
it("accepts a successful account change and preserves safe API error messages", async () => {
  await readChartMutationResponse(Response.json({ message: "Saved" }));
  await assert.rejects(readChartMutationResponse(Response.json({ message: "Private General Ledger access is required." }, { status: 403 })), { message: "Private General Ledger access is required." });
});

it("reads Falco's standard validation envelope without a technical field prefix", async () => {
  await assert.rejects(readChartMutationResponse(Response.json({ error: { code: "VALIDATION_ERROR", message: "The given data was invalid.", details: [{ field: "node", message: "Cannot delete because it contains a record." }] } }, { status: 422 })), { message: "Cannot delete because it contains a record." });
});
