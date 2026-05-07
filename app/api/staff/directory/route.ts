import { NextResponse } from "next/server";
import { branches, currentUser } from "@/lib/mock-data";
import {
  addDirectoryUser,
  listDirectoryUsers,
  nextDirectoryEmployeeId,
} from "@/lib/mock-user-directory";
import { roleHasPortalAccess } from "@/components/staff-management/utils";
import type { StaffRole } from "@/components/staff-management/types";
import type { User, UserRole } from "@/lib/types";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

const CREATABLE_ROLES: StaffRole[] = [
  "super_admin",
  "branch_manager",
  "loan_officer",
  "credit_analyst",
  "collections_officer",
];

export async function GET() {
  return NextResponse.json({ users: listDirectoryUsers() });
}

/** Super admin: create an active directory user immediately (portal roles require initial password). */
export async function POST(request: Request) {
  if (currentUser.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    full_name?: string;
    email?: string;
    phone?: string;
    role?: StaffRole;
    branch_id?: string;
    password?: string | null;
    confirmPassword?: string | null;
  };

  const email = body.email?.trim().toLowerCase();
  const full_name = body.full_name?.trim();
  const phone = body.phone?.trim();
  const role = body.role;
  const branch_id = body.branch_id;

  if (!full_name || !email || !phone || !role || !branch_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (!CREATABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (!branches.some((b) => b.id === branch_id)) {
    return NextResponse.json({ error: "Invalid branch" }, { status: 400 });
  }

  if (listDirectoryUsers().some((u) => u.email.toLowerCase() === email)) {
    return NextResponse.json({ error: "Email already exists" }, { status: 400 });
  }

  const portal = roleHasPortalAccess(role);
  const password = body.password?.trim() ?? "";
  const confirm = body.confirmPassword?.trim() ?? "";

  if (portal) {
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters for portal roles" },
        { status: 400 }
      );
    }
    if (password !== confirm) {
      return NextResponse.json({ error: "Password confirmation does not match" }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  const newUser: User = {
    id: uid("usr"),
    email,
    full_name,
    phone,
    role: role as UserRole,
    branch_id,
    employee_id: nextDirectoryEmployeeId(),
    is_active: true,
    created_at: now,
    last_login: null,
  };

  addDirectoryUser(newUser);

  return NextResponse.json({
    user: newUser,
    /** Mock only: confirms portal password met validation; not persisted on User. */
    portal_credentials_set: portal,
  });
}
