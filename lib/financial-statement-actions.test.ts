import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FINANCIAL_STATEMENT_EDITING_ENABLED, statementWorkspaceActions } from "./financial-statements";

describe("paused financial statement editing", () => {
  it("keeps configuration and adjustment tools inactive even for super administrators", () => {
    assert.equal(FINANCIAL_STATEMENT_EDITING_ENABLED, false);
    assert.deepEqual(statementWorkspaceActions({ role: "super_admin" }), {
      canExport: true, canConfigure: false, canPost: false,
    });
    assert.deepEqual(statementWorkspaceActions({ permissions: ["all"] }), {
      canExport: true, canConfigure: false, canPost: false,
    });
  });

  it("does not grant editing through explicit action permissions", () => {
    assert.deepEqual(statementWorkspaceActions({ permissions: ["gl.view", "gl.configure", "gl.post"] }), {
      canExport: false, canConfigure: false, canPost: false,
    });
  });

  it("preserves existing export permission checks", () => {
    assert.equal(statementWorkspaceActions({ permissions: ["gl.export"] }).canExport, true);
    assert.equal(statementWorkspaceActions({ role: "admin", permissions: ["gl.view"] }).canExport, false);
    assert.deepEqual(statementWorkspaceActions(null), { canExport: false, canConfigure: false, canPost: false });
  });
});
