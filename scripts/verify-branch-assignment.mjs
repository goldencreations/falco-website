#!/usr/bin/env node
/**
 * Verify staff branch_id resolves to a real branch on the Falco API.
 *
 * Usage:
 *   FALCO_EMAIL=filbert.pamba@falco.co.tz FALCO_PASSWORD='...' node scripts/verify-branch-assignment.mjs
 *
 * Optional:
 *   FALCO_API_BASE_URL=https://falco.goldencreations.online
 */

const base = (process.env.FALCO_API_BASE_URL || "https://falco.goldencreations.online").replace(
  /\/$/,
  ""
);
const email = process.env.FALCO_EMAIL?.trim().toLowerCase();
const password = process.env.FALCO_PASSWORD;

function normalizeBranchKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^branch[-_\s]*/, "")
    .replace(/[^a-z0-9]/g, "");
}

function branchMatchesScope(branch, scopedId) {
  const scope = normalizeBranchKey(scopedId);
  return (
    normalizeBranchKey(branch.id) === scope || normalizeBranchKey(branch.code ?? "") === scope
  );
}

function extractBranches(json) {
  const rows = json?.branches ?? json?.data ?? [];
  return Array.isArray(rows) ? rows : [];
}

async function main() {
  if (!email || !password) {
    console.error("Set FALCO_EMAIL and FALCO_PASSWORD to run this check.");
    process.exit(1);
  }

  console.log(`API: ${base}`);
  console.log(`User: ${email}\n`);

  const loginRes = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginJson = await loginRes.json().catch(() => ({}));
  const token = loginJson.access_token ?? loginJson.tokens?.access_token;
  if (!loginRes.ok || !token) {
    console.error("Login failed:", loginRes.status, loginJson.message ?? loginJson);
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  const meRes = await fetch(`${base}/api/me`, { headers: auth });
  const meJson = await meRes.json().catch(() => ({}));
  const user = meJson.user ?? meJson;
  if (!meRes.ok || !user?.email) {
    console.error("/api/me failed:", meRes.status, meJson);
    process.exit(1);
  }

  const branchRes = await fetch(`${base}/branches`, { headers: auth });
  const branchJson = await branchRes.json().catch(() => ({}));
  const branches = extractBranches(branchJson);
  if (!branchRes.ok) {
    console.error("/branches failed:", branchRes.status, branchJson);
    process.exit(1);
  }

  const branchId = String(user.branch_id ?? "").trim();
  const match = branches.find((b) => branchMatchesScope(b, branchId));

  console.log("Session (/api/me):");
  console.log(`  role:        ${user.role}`);
  console.log(`  branch_id:   ${branchId || "(empty)"}`);
  console.log(`  branch_name: ${user.branch_name ?? "(not set)"}`);
  console.log(`\nBranches visible (${branches.length}):`);
  for (const b of branches.slice(0, 10)) {
    console.log(`  - ${b.name} (id=${b.id}, code=${b.code ?? "—"})`);
  }
  if (branches.length > 10) console.log(`  … and ${branches.length - 10} more`);

  console.log("");
  if (!branchId) {
    console.log("FAIL: User has no branch_id.");
    process.exit(1);
  }
  if (/^branch[-_][a-z0-9-]+$/i.test(branchId) && !match) {
    console.log(`FAIL: branch_id looks like orphan slug "${branchId}" — not in /branches.`);
    process.exit(1);
  }
  if (!match) {
    console.log(`FAIL: branch_id "${branchId}" does not match any branch id/code.`);
    process.exit(1);
  }

  console.log(`OK: branch_id resolves to "${match.name}" (id=${match.id}, code=${match.code ?? "—"})`);

  const custRes = await fetch(`${base}/customers?page_size=5`, { headers: auth });
  const custJson = await custRes.json().catch(() => ({}));
  const customers = Array.isArray(custJson.data) ? custJson.data : [];
  if (custRes.ok) {
    console.log(`\nGET /customers (first page): ${customers.length} row(s) returned.`);
    if (customers[0]?.branch_id) {
      const sample = customers[0];
      const custMatch = branchMatchesScope(match, sample.branch_id);
      console.log(
        `  Sample customer branch_id=${sample.branch_id} → ${custMatch ? "same branch" : "DIFFERENT BRANCH"}`
      );
    }
  } else {
    console.log("\n(Warn) GET /customers failed:", custRes.status);
  }

  console.log("\nAll checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
