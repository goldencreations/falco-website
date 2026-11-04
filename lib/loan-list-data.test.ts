import assert from "node:assert/strict";
import { test } from "node:test";
import { loadLoanPortfolio, loanPortfolioUrl } from "./loan-list-data";

const response = (data: unknown[], page: number, total: number, pageSize = 100) =>
  new Response(JSON.stringify({ data, meta: { page, total, page_size: pageSize } }));
const loan = (id: number, status = "paid_off") => ({ id: String(id), status, principal: "200000.00", total_outstanding: "0.00" });

test("portfolio URLs keep paid-off inclusion and exclusion separate and preserve branch scope", () => {
  const paid = new URL(loanPortfolioUrl("paid_off", "branch-001", 2), "https://falco.test");
  assert.equal(paid.searchParams.get("status"), "paid_off");
  assert.equal(paid.searchParams.has("exclude_status"), false);
  assert.equal(paid.searchParams.get("branch_id"), "branch-001");
  assert.equal(paid.searchParams.get("page"), "2");
  const current = new URL(loanPortfolioUrl("current", null, 1), "https://falco.test");
  assert.equal(current.searchParams.get("exclude_status"), "paid_off");
  assert.equal(current.searchParams.has("status"), false);
});

test("all pages are consumed beyond 100 loans and original-principal totals include older records", async () => {
  const calls: string[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push(url);
    assert.equal(init.cache, "no-store");
    const page = Number(new URL(url, "https://falco.test").searchParams.get("page"));
    return response(page === 1 ? Array.from({ length: 100 }, (_, i) => loan(i + 1)) : [loan(101)], page, 101);
  }) as typeof fetch;
  const rows = await loadLoanPortfolio("paid_off", null, undefined, fetcher);
  assert.equal(calls.length, 2);
  assert.equal(rows.length, 101);
  assert.equal(rows[100].id, "101");
  assert.equal(rows.reduce((sum, row) => sum + row.principal_amount, 0), 20200000);
});

test("an empty officer-filtered intermediate page does not hide later assigned loans", async () => {
  const fetcher = (async (url: string) => {
    const page = Number(new URL(url, "https://falco.test").searchParams.get("page"));
    return response(page === 2 ? [] : [loan(page)], page, 201);
  }) as typeof fetch;
  const rows = await loadLoanPortfolio("paid_off", "branch-001", undefined, fetcher);
  assert.deepEqual(rows.map(row => row.id), ["1", "3"]);
});

test("recorded status controls membership even when displayed outstanding is zero", async () => {
  const fetcher = (async () => response([loan(1, "active"), loan(2), loan(3, "pending_disbursement"), loan(4, "in_arrears")], 1, 4)) as typeof fetch;
  assert.deepEqual((await loadLoanPortfolio("paid_off", null, undefined, fetcher)).map(row => row.id), ["2"]);
  assert.deepEqual((await loadLoanPortfolio("current", null, undefined, fetcher)).map(row => row.id), ["1", "3", "4"]);
});

test("a failed later page rejects the incomplete list instead of returning partial totals", async () => {
  const fetcher = (async (url: string) => new URL(url, "https://falco.test").searchParams.get("page") === "1"
    ? response([loan(1)], 1, 101)
    : new Response(JSON.stringify({ message: "Service unavailable" }), { status: 503 })) as typeof fetch;
  await assert.rejects(loadLoanPortfolio("paid_off", null, undefined, fetcher), /Service unavailable/);
});

test("missing pagination metadata is reported and a truly empty portfolio succeeds", async () => {
  await assert.rejects(loadLoanPortfolio("paid_off", null, undefined, (async () => new Response('{"data":[]}')) as typeof fetch), /incomplete/);
  assert.deepEqual(await loadLoanPortfolio("paid_off", null, undefined, (async () => response([], 1, 0)) as typeof fetch), []);
});
