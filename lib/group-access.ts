import type { SessionUser } from "@/lib/auth";

type GroupActor = Pick<SessionUser, "role" | "permissions"> & {
  permissions?: string[];
};

function hasGroupPermission(user: GroupActor, permission: string): boolean {
  return Boolean(
    user.permissions?.includes("all") || user.permissions?.includes(permission)
  );
}

export function canManageGroups(user: GroupActor): boolean {
  return hasGroupPermission(user, "groups.manage");
}

export function canCreateGroups(user: GroupActor): boolean {
  return hasGroupPermission(user, "groups.create") || canManageGroups(user);
}

/** Loan officers with create-only access — branch and officer fields are locked to the session user. */
export function isCreateOnlyGroupOfficer(user: GroupActor): boolean {
  return hasGroupPermission(user, "groups.create") && !canManageGroups(user);
}

export function canViewGroups(user: GroupActor): boolean {
  return (
    hasGroupPermission(user, "groups.view") ||
    canCreateGroups(user) ||
    canManageGroups(user)
  );
}
