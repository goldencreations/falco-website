import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCreateGroups,
  canManageGroups,
  canViewGroups,
  isCreateOnlyGroupOfficer,
} from "./group-access";

describe("group access permissions", () => {
  it("allows create when groups.create is granted", () => {
    const user = { role: "loan_officer" as const, permissions: ["groups.view", "groups.create"] };
    assert.equal(canCreateGroups(user), true);
    assert.equal(canManageGroups(user), false);
    assert.equal(isCreateOnlyGroupOfficer(user), true);
  });

  it("allows full management when groups.manage is granted", () => {
    const user = { role: "branch_manager" as const, permissions: ["groups.view", "groups.manage"] };
    assert.equal(canCreateGroups(user), true);
    assert.equal(canManageGroups(user), true);
    assert.equal(isCreateOnlyGroupOfficer(user), false);
  });

  it("treats manage as sufficient for create", () => {
    const user = { role: "super_admin" as const, permissions: ["groups.manage"] };
    assert.equal(canCreateGroups(user), true);
    assert.equal(canViewGroups(user), true);
  });

  it("treats all as full group management", () => {
    const user = { role: "super_admin" as const, permissions: ["all"] };
    assert.equal(canManageGroups(user), true);
    assert.equal(canCreateGroups(user), true);
    assert.equal(isCreateOnlyGroupOfficer(user), false);
  });
});
