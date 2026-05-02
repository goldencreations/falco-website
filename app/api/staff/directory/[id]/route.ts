import { NextResponse } from "next/server";
import { currentUser } from "@/lib/mock-data";
import { getDirectoryUserById, patchDirectoryUser } from "@/lib/mock-user-directory";
import type { User, UserRole } from "@/lib/types";

const PATCHABLE: (keyof User)[] = [
  "email",
  "full_name",
  "phone",
  "role",
  "branch_id",
  "is_active",
];

const ROLES: UserRole[] = [
  "super_admin",
  "branch_manager",
  "loan_officer",
  "credit_analyst",
  "collections_officer",
];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (currentUser.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = getDirectoryUserById(id);
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const patch: Partial<User> = {};

  for (const key of PATCHABLE) {
    if (key in body && body[key] !== undefined) {
      const v = body[key];
      if (key === "role") {
        if (typeof v !== "string" || !ROLES.includes(v as UserRole)) {
          return NextResponse.json({ error: "Invalid role" }, { status: 400 });
        }
        patch.role = v as UserRole;
      } else if (key === "is_active") {
        if (typeof v !== "boolean") {
          return NextResponse.json({ error: "is_active must be boolean" }, { status: 400 });
        }
        patch.is_active = v;
      } else if (typeof v === "string") {
        patch[key] = v as never;
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = patchDirectoryUser(id, patch);
  return NextResponse.json({ user: updated });
}
