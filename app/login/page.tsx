import { redirect } from "next/navigation";

/** Login UI lives at `/`; keep this route so bookmarks redirect cleanly. */
export default function LoginPage() {
  redirect("/");
}
