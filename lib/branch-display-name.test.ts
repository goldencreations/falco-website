import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findBranchForScope,
  formatSessionBranchField,
  hasOrphanBranchAssignment,
  isBranchIdentifierSlug,
  isPlaceholderBranchName,
  resolveBranchDisplayName,
} from "./branch-display-name";
import type { Branch } from "./types";

const mbagala: Branch = {
  id: "42",
  name: "Mbagala",
  code: "BRANCH-MBAGALA",
  region: "",
  address: "",
  phone: "",
  manager_id: "",
  is_active: true,
};

describe("isPlaceholderBranchName", () => {
  it("flags generic branch labels", () => {
    assert.equal(isPlaceholderBranchName("Branch"), true);
    assert.equal(isPlaceholderBranchName("Your branch"), true);
    assert.equal(isPlaceholderBranchName("Branch branch-d012"), true);
    assert.equal(isPlaceholderBranchName("branch-dom01"), true);
    assert.equal(isPlaceholderBranchName("Mbagala"), false);
  });
});

describe("findBranchForScope", () => {
  it("matches by branch code when session stores the code", () => {
    const match = findBranchForScope([mbagala], "BRANCH-MBAGALA");
    assert.equal(match?.name, "Mbagala");
  });

  it("matches by branch id", () => {
    const match = findBranchForScope([mbagala], "42");
    assert.equal(match?.name, "Mbagala");
  });

  it("prefers a named branch over a synthetic placeholder with the same scope", () => {
    const synthetic = { ...mbagala, id: "BRANCH-MBAGALA", code: "BRANCH-MBAGALA", name: "Branch" };
    assert.equal(findBranchForScope([synthetic, mbagala], "BRANCH-MBAGALA")?.name, "Mbagala");
  });
});

describe("resolveBranchDisplayName", () => {
  it("prefers the scoped branch name over placeholders", () => {
    assert.equal(
      resolveBranchDisplayName({
        branchId: "BRANCH-MBAGALA",
        branchName: "Branch",
        branches: [mbagala],
      }),
      "Mbagala"
    );
  });

  it("uses session branch name when branch list is unavailable", () => {
    assert.equal(
      resolveBranchDisplayName({
        branchId: "BRANCH-MBAGALA",
        branchName: "Mbagala",
        branches: [],
      }),
      "Mbagala"
    );
  });

  it("returns undefined for orphan branch keys such as branch-dom01", () => {
    assert.equal(
      resolveBranchDisplayName({
        branchId: "branch-dom01",
        branchName: "branch-dom01",
        branches: [mbagala],
      }),
      undefined
    );
    assert.equal(
      hasOrphanBranchAssignment({
        branchId: "branch-dom01",
        branches: [mbagala],
      }),
      true
    );
  });
});

describe("formatSessionBranchField", () => {
  it("shows the session name and raw branch_id without inventing a label", () => {
    assert.deepEqual(
      formatSessionBranchField({ branchId: "42", branchName: "FALCO MBAGALA BRANCH" }),
      { name: "FALCO MBAGALA BRANCH", branchId: "42" }
    );
    assert.deepEqual(
      formatSessionBranchField({ branchId: "branch-dom01", branchName: "branch-dom01" }),
      { name: "", branchId: "branch-dom01" }
    );
  });
});
