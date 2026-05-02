"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Building2, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginScreen() {
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
    <main className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-primary/[0.06] p-4 md:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[2.25rem] border border-border bg-card text-card-foreground shadow-md md:grid-cols-[420px_1fr]">
        <section className="flex items-center px-6 py-10 md:px-10">
          <div className="w-full">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Building2 className="h-5 w-5" aria-hidden />
              </div>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                Falco Financial
              </p>
            </div>

            <h1 className="text-4xl font-semibold tracking-tight text-foreground">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to continue to your dashboard.
            </p>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 bg-background/80 dark:bg-input/30"
                  placeholder="superadmin@falco.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-muted-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 bg-background/80 pr-10 dark:bg-input/30"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-foreground">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                  />
                  <span>Remember me</span>
                </label>
                <Button type="button" variant="link" className="h-auto p-0 text-primary">
                  Forgot password?
                </Button>
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <Button type="submit" disabled={loading} className="mt-2 h-11 w-full" size="lg">
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <span className="font-semibold text-primary">Sign up</span>
            </p>

            <p className="mt-8 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-primary">Demo:</span> superadmin@falco.com / SuperAdmin@123
            </p>
          </div>
        </section>

        <section className="relative hidden bg-sidebar p-4 md:block">
          <div className="relative h-full w-full min-h-[280px] overflow-hidden rounded-[2rem] ring-1 ring-sidebar-border">
            <Image
              src="/login.jpg"
              alt=""
              fill
              priority
              quality={85}
              className="object-cover"
              sizes="(min-width: 768px) 60vw, 100vw"
            />
          </div>
          <div
            className="pointer-events-none absolute inset-4 rounded-[2rem] bg-gradient-to-br from-primary/35 via-transparent to-sidebar/45"
            aria-hidden
          />
        </section>
      </div>
    </main>
  );
}
