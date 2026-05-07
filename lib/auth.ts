import { cookies } from "next/headers";
import { users } from "@/lib/mock-data";
import type { User, UserRole } from "@/lib/types";

export const AUTH_COOKIE_NAME = "falco_auth";

export type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
  branch_id: string;
  full_name: string;
};

function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    branch_id: user.branch_id,
    full_name: user.full_name,
  };
}

export function buildSessionToken(user: User): string {
  const raw = JSON.stringify(toSessionUser(user));
  return Buffer.from(raw, "utf-8").toString("base64url");
}

export function parseSessionToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, "base64url").toString("utf-8");
    const parsed = JSON.parse(raw) as Partial<SessionUser>;
    if (!parsed.id || !parsed.role || !parsed.branch_id || !parsed.email || !parsed.full_name) {
      return null;
    }
    const user = users.find((candidate) => candidate.id === parsed.id && candidate.email === parsed.email);
    if (!user || !user.is_active) return null;
    return toSessionUser(user);
  } catch {
    return null;
  }
}

export async function getServerSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  return parseSessionToken(token);
}

export function authenticateByEmailPassword(input: { email?: string; password?: string }): User | null {
  const email = input.email?.trim().toLowerCase();
  const password = input.password ?? "";
  if (!email || !password) return null;

  const user = users.find((candidate) => candidate.email.toLowerCase() === email && candidate.is_active);
  if (!user) return null;

  // Mock credentials for now; replace with backend hash verification once integrated.
  const validSuperAdmin = user.role === "super_admin" && password === "SuperAdmin@123";
  const validBranchManager = user.role === "branch_manager" && password === "Manager@123";
  const validLoanOfficer = user.role === "loan_officer" && password === "Officer@123";
  return validSuperAdmin || validBranchManager || validLoanOfficer ? user : null;
}
