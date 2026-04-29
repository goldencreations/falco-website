"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

const SIDE_IMAGE_URL = "https://source.unsplash.com/hpjSkU2UYSU/1200x1600";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("superadmin@falco.com");
  const [password, setPassword] = useState("SuperAdmin@123");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setError(payload.message ?? "Invalid credentials.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to login right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f5f7] p-4 md:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[2.25rem] bg-white shadow-sm md:grid-cols-[420px_1fr]">
        <section className="flex items-center px-6 py-10 md:px-10">
          <div className="w-full">
            <div className="mb-10 flex items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-[#5a234f]" />
              <p className="text-2xl font-semibold text-[#3b3146]">Havenix.</p>
            </div>

            <h1 className="text-4xl font-semibold text-[#111111]">Welcome Back</h1>
            <p className="mt-1 text-sm text-[#797979]">Let&apos;s login to grab amazing deal</p>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#7b7b7b]">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 w-full rounded-md border border-[#e5e5e5] bg-[#f8f8f8] px-3 text-sm outline-none focus:border-[#5a234f]"
                  placeholder="superadmin@falco.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-[#7b7b7b]">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 w-full rounded-md border border-[#e5e5e5] bg-[#f8f8f8] px-3 pr-10 text-sm outline-none focus:border-[#5a234f]"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7b7b7b]"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-sm">
                <label className="flex items-center gap-2 text-[#444]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  Remember me
                </label>
                <button type="button" className="text-[#3b3146] underline underline-offset-2">
                  Forgot Password?
                </button>
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 h-11 w-full rounded-md bg-[#5a234f] text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[#555]">
              Don&apos;t have an account? <span className="font-semibold">Sign Up</span>
            </p>

            <p className="mt-8 rounded-md bg-[#f6f2f5] p-3 text-xs text-[#5a234f]">
              Super Admin login: superadmin@falco.com / SuperAdmin@123
            </p>
          </div>
        </section>

        <section className="relative hidden p-4 md:block">
          <div
            className="h-full w-full rounded-[2rem] bg-cover bg-center"
            style={{ backgroundImage: `url(${SIDE_IMAGE_URL})` }}
          />
          <div className="pointer-events-none absolute inset-4 rounded-[2rem] bg-gradient-to-b from-black/25 via-transparent to-black/10" />
          <p className="absolute right-12 top-10 max-w-xs text-right text-sm font-medium text-white">
            Browse thousands of properties to buy, sell, or rent with trusted agents.
          </p>
        </section>
      </div>
    </main>
  );
}
