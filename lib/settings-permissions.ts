import type { SessionUserClient } from "@/lib/use-session-user";

function permissionsFor(user: Pick<SessionUserClient, "role" | "permissions">): string[] {
 if (user.permissions?.length) return user.permissions;
 if (user.role === "super_admin") return ["settings.view", "settings.manage"];
 if (user.role === "branch_manager") return ["settings.view"];
 return [];
}

export function canViewOrganizationSettings(
 user: Pick<SessionUserClient, "role" | "permissions"> | null | undefined
): boolean {
 if (!user) return false;
 const perms = permissionsFor(user);
 return perms.includes("settings.view") || perms.includes("settings.manage");
}

export function canManageOrganizationSettings(
 user: Pick<SessionUserClient, "role" | "permissions"> | null | undefined
): boolean {
 if (!user) return false;
 const perms = permissionsFor(user);
 return perms.includes("settings.manage");
}

export function canViewSettingsBranches(
 user: Pick<SessionUserClient, "role" | "permissions" | "branch_id"> | null | undefined
): boolean {
 if (!user) return false;
 if (user.role === "loan_officer") return Boolean(user.branch_id?.trim());
 if (user.role === "super_admin" || user.role === "branch_manager") return true;
 const perms = permissionsFor(user);
 return perms.includes("settings.view") || perms.includes("branches.view");
}
