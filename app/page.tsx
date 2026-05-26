import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginScreen } from "@/components/login-screen";
import { ACCESS_TOKEN_COOKIE_NAME, APP_ROLE_COOKIE_NAME } from "@/lib/auth";
import { loginRedirectForRole, ROLE_HOME_PATH } from "@/lib/role-portal";
import type { UserRole } from "@/lib/types";

/** Skip login UI when session cookies are already valid (fast path on slow networks). */
export default async function HomePage() {
 const cookieStore = await cookies();
 const token = cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
 const roleRaw = cookieStore.get(APP_ROLE_COOKIE_NAME)?.value;
 if (token && roleRaw && roleRaw in ROLE_HOME_PATH) {
 redirect(loginRedirectForRole(roleRaw as UserRole));
 }
 return <LoginScreen />;
}
