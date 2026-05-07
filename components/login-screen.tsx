"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Building2, Eye, EyeOff, Globe, Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import {
 type AppLanguage,
 isAppLanguage,
 LANGUAGE_STORAGE_KEY,
} from "@/lib/preferences";

export function LoginScreen() {
 const router = useRouter();
 const [email, setEmail] = useState("admin@falcofinancial.co.tz");
 const [password, setPassword] = useState("SuperAdmin@123");
 const [showPassword, setShowPassword] = useState(false);
 const [rememberMe, setRememberMe] = useState(false);
 const [error, setError] = useState("");
 const [loading, setLoading] = useState(false);
 const [language, setLanguage] = useState<AppLanguage>("en");

 useEffect(() => {
 const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
 if (isAppLanguage(savedLanguage)) setLanguage(savedLanguage);
 }, []);

 useEffect(() => {
 localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
 document.documentElement.setAttribute("lang", language === "sw" ? "sw" : "en");
 }, [language]);

 const t = useMemo(() => {
 if (language === "sw") {
 return {
 welcome: "Karibu tena",
 subtitle: "Ingia kuendelea kwenye dashibodi yako.",
 email: "Barua pepe",
 password: "Nenosiri",
 remember: "Nikumbuke",
 forgot: "Umesahau nenosiri?",
 signIn: "Ingia",
 signingIn: "Inaingia...",
 noAccount: "Huna akaunti?",
 signUp: "Jisajili",
 demo: "Jaribio",
 invalidCredentials: "Taarifa za kuingia si sahihi.",
 unableToLogin: "Imeshindikana kuingia sasa. Tafadhali jaribu tena.",
    language: "Lugha",
 };
 }
 return {
 welcome: "Welcome back",
 subtitle: "Sign in to continue to your dashboard.",
 email: "Email",
 password: "Password",
 remember: "Remember me",
 forgot: "Forgot password?",
 signIn: "Sign in",
 signingIn: "Signing in...",
 noAccount: "Don't have an account?",
 signUp: "Sign up",
 demo: "Demo",
 invalidCredentials: "Invalid credentials.",
 unableToLogin: "Unable to login right now. Please try again.",
    language: "Language",
 };
 }, [language]);

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
 setError(payload.message ?? t.invalidCredentials);
 return;
 }

 const payload = (await response.json()) as { redirectTo?: string };
 router.push(payload.redirectTo ?? "/dashboard");
 router.refresh();
 } catch {
 setError(t.unableToLogin);
 } finally {
 setLoading(false);
 }
 };

 return (
 <main className="min-h-screen bg-gradient-to-br from-slate-100 via-background to-emerald-100/40 p-4 md:p-8">
 <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[2.25rem] border border-border bg-card text-card-foreground shadow-md ring-1 ring-emerald-100/70 md:grid-cols-[420px_1fr]">
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

 <h1 className="text-4xl font-semibold tracking-tight text-foreground">{t.welcome}</h1>
 <p className="mt-1 text-sm text-muted-foreground">
 {t.subtitle}
 </p>

 <div className="mt-4 w-1/2">
 <Label className="mb-1 block text-xs text-muted-foreground">{t.language}</Label>
 <Select value={language} onValueChange={(value: AppLanguage) => setLanguage(value)}>
 <SelectTrigger className="h-9 bg-background/80">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="en">
 <span className="inline-flex items-center gap-2">
 <Globe className="h-3.5 w-3.5" /> English
 </span>
 </SelectItem>
 <SelectItem value="sw">
 <span className="inline-flex items-center gap-2">
 <Languages className="h-3.5 w-3.5" /> Kiswahili
 </span>
 </SelectItem>
 </SelectContent>
 </Select>
 </div>

 <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
 <div className="space-y-2">
 <Label htmlFor="login-email" className="text-muted-foreground">
 {t.email}
 </Label>
 <Input
 id="login-email"
 type="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 className="h-11 bg-background/80 "
 placeholder="admin@falcofinancial.co.tz"
 autoComplete="email"
 required
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="login-password" className="text-muted-foreground">
 {t.password}
 </Label>
 <div className="relative">
 <Input
 id="login-password"
 type={showPassword ? "text" : "password"}
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 className="h-11 bg-background/80 pr-10 "
 placeholder={t.password}
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
 <span>{t.remember}</span>
 </label>
 <Button type="button" variant="link" className="h-auto p-0 text-primary">
 {t.forgot}
 </Button>
 </div>

 {error ? <p className="text-sm text-destructive">{error}</p> : null}

 <Button type="submit" disabled={loading} className="mt-2 h-11 w-full" size="lg">
 {loading ? t.signingIn : t.signIn}
 </Button>
 </form>

 <p className="mt-6 text-center text-sm text-muted-foreground">
 {t.noAccount} <span className="font-semibold text-primary">{t.signUp}</span>
 </p>

 <div className="mt-8 space-y-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
 <p className="font-medium text-primary">{t.demo} Credentials</p>
 <p>
 <span className="font-semibold text-foreground">Super Admin:</span>{" "}
 <span className="rounded bg-background/70 px-1.5 py-0.5">admin@falcofinancial.co.tz</span>{" "}
 /{" "}
 <span className="rounded bg-background/70 px-1.5 py-0.5">SuperAdmin@123</span>
 </p>
 <p>
 <span className="font-semibold text-foreground">Manager:</span>{" "}
 <span className="rounded bg-background/70 px-1.5 py-0.5">grace.mushi@falcofinancial.co.tz</span>{" "}
 /{" "}
 <span className="rounded bg-background/70 px-1.5 py-0.5">Manager@123</span>
 </p>
 <p>
 <span className="font-semibold text-foreground">Loan Officer:</span>{" "}
 <span className="rounded bg-background/70 px-1.5 py-0.5">john.kimaro@falcofinancial.co.tz</span>{" "}
 /{" "}
 <span className="rounded bg-background/70 px-1.5 py-0.5">Officer@123</span>
 </p>
 </div>
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
