import { redirect } from "next/navigation";
import { LoginScreen } from "@/components/login-screen";
import { getServerSessionUser } from "@/lib/auth";
import { loginRedirectForRole } from "@/lib/role-portal";

/** Skip login UI when the access token resolves to a valid session (role from API, not stale cookie). */
export default async function HomePage() {
 const user = await getServerSessionUser();
 if (user) {
 redirect(loginRedirectForRole(user.role));
 }
 return <LoginScreen />;
}
