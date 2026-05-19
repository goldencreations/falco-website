"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
 BadgeCheck,
 Building2,
 Globe,
 KeyRound,
 Languages,
 Lock,
 Save,
 ShieldCheck,
 UserRound,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { formatApiResponseError } from "@/lib/falco-api";
import { useLanguage } from "@/components/language-provider";
import { settingsCopy, tLabel } from "@/lib/i18n/labels";
import { type AppLanguage, isAppLanguage } from "@/lib/preferences";
import type { OrganizationSettings, ProfilePreferences } from "@/lib/settings-adapters";
import {
 canManageOrganizationSettings,
 canViewOrganizationSettings,
} from "@/lib/settings-permissions";
import { useSessionUser, type SessionUserClient } from "@/lib/use-session-user";

function roleLabel(role: string): string {
 if (role === "branch_manager") return "Branch manager";
 if (role === "loan_officer") return "Loan officer";
 if (role === "super_admin") return "Super admin";
 return role.replace(/_/g, " ");
}

function roleBadgeLabel(role: string): string {
 if (role === "branch_manager") return "Manager Controls";
 if (role === "loan_officer") return "Loan Officer Controls";
 return "Super Admin Controls";
}

const DEFAULT_PREFERENCES: ProfilePreferences = {
 theme_mode: "system",
 language: "en",
 email_alerts: true,
 session_lock_enabled: true,
};

export default function SettingsPage() {
 const { language, setLanguage, refreshFromServer } = useLanguage();
 const copy = settingsCopy(language);
 const L = (text: string) => tLabel(text, language);
 const { user: sessionUser, loaded: sessionLoaded } = useSessionUser();
 const [profileUser, setProfileUser] = useState<SessionUserClient | null>(null);
 const [branchName, setBranchName] = useState<string>("");
 const [preferences, setPreferences] = useState<ProfilePreferences>(DEFAULT_PREFERENCES);
 const [orgSettings, setOrgSettings] = useState<OrganizationSettings | null>(null);

 const [loading, setLoading] = useState(true);
 const [loadError, setLoadError] = useState("");
 const [profilePartial, setProfilePartial] = useState(false);

 const [savingPrefs, setSavingPrefs] = useState(false);
 const [savingPassword, setSavingPassword] = useState(false);
 const [savingOrg, setSavingOrg] = useState(false);
 const [prefsMessage, setPrefsMessage] = useState("");
 const [prefsError, setPrefsError] = useState("");
 const [passwordMessage, setPasswordMessage] = useState("");
 const [passwordError, setPasswordError] = useState("");
 const [orgMessage, setOrgMessage] = useState("");
 const [orgError, setOrgError] = useState("");

 const [currentPassword, setCurrentPassword] = useState("");
 const [newPassword, setNewPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");

 const displayUser = profileUser ?? sessionUser;
 const canViewOrg = canViewOrganizationSettings(sessionUser);
 const canManageOrg = canManageOrganizationSettings(sessionUser);

 const loadSettings = useCallback(async () => {
 if (!sessionLoaded || !sessionUser) return;
 setLoading(true);
 setLoadError("");
 setProfilePartial(false);
 try {
 const profileRes = await fetch("/api/settings/profile", { credentials: "include" });
 const profileJson = (await profileRes.json().catch(() => ({}))) as {
 user?: SessionUserClient;
 preferences?: ProfilePreferences;
 message?: string;
 partial?: boolean;
 };

 if (profileJson.partial || (!profileRes.ok && profileJson.user)) {
 setProfilePartial(true);
 setProfileUser(profileJson.user ?? sessionUser);
 const prefs = profileJson.preferences ?? DEFAULT_PREFERENCES;
 setPreferences(prefs);
 setLanguage(prefs.language);
 } else if (!profileRes.ok) {
 throw new Error(formatApiResponseError(profileJson, "Could not load profile settings"));
 } else {
 if (profileJson.user) setProfileUser(profileJson.user);
 const prefs = profileJson.preferences ?? DEFAULT_PREFERENCES;
 setPreferences(prefs);
 setLanguage(prefs.language);
 }

 const bid = profileJson.user?.branch_id ?? sessionUser.branch_id;
 let resolvedBranchName = bid ?? "";

 try {
 const branchRes = await fetch("/api/settings/branches", { credentials: "include" });
 if (branchRes.ok) {
 const branchJson = (await branchRes.json()) as { data?: { id: string; name: string }[] };
 const match = branchJson.data?.find((b) => b.id === bid);
 resolvedBranchName = match?.name ?? resolvedBranchName;
 }
 } catch {
 /* try falco branches */
 }

 if (!resolvedBranchName || resolvedBranchName === bid) {
 try {
 const falcoRes = await fetch("/api/falco/branches", { credentials: "include" });
 if (falcoRes.ok) {
 const falcoJson = (await falcoRes.json()) as { branches?: { id: string; name: string }[] };
 const match = falcoJson.branches?.find((b) => b.id === bid);
 if (match?.name) resolvedBranchName = match.name;
 }
 } catch {
 /* keep id */
 }
 }

 setBranchName(resolvedBranchName || bid || "");

 if (canViewOrganizationSettings(sessionUser)) {
 const orgRes = await fetch("/api/settings/organization", { credentials: "include" });
 if (orgRes.ok) {
 const orgJson = (await orgRes.json()) as { settings?: OrganizationSettings };
 if (orgJson.settings) setOrgSettings(orgJson.settings);
 } else if (orgRes.status !== 403) {
 const orgErr = (await orgRes.json().catch(() => ({}))) as { message?: string };
 setLoadError((prev) =>
 prev ? prev : formatApiResponseError(orgErr, "Could not load organization settings")
 );
 }
 }
 } catch (e) {
 setLoadError(e instanceof Error ? e.message : "Failed to load settings");
 } finally {
 setLoading(false);
 }
 }, [sessionLoaded, sessionUser, setLanguage, refreshFromServer]);

 useEffect(() => {
 void loadSettings();
 }, [loadSettings]);

 const savePreferences = async () => {
 setSavingPrefs(true);
 setPrefsMessage("");
 setPrefsError("");
 try {
 const res = await fetch("/api/settings/profile/preferences", {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(preferences),
 });
 const json = (await res.json().catch(() => ({}))) as {
 preferences?: ProfilePreferences;
 message?: string;
 };
 if (!res.ok) {
 setPrefsError(formatApiResponseError(json, "Could not save preferences"));
 return;
 }
 const saved = json.preferences ?? preferences;
 setPreferences(saved);
 setLanguage(saved.language);
 await refreshFromServer();
 setPrefsMessage(copy.prefsSaved);
 } catch (e) {
 setPrefsError(e instanceof Error ? e.message : "Save failed");
 } finally {
 setSavingPrefs(false);
 }
 };

 const savePassword = async () => {
 setPasswordMessage("");
 setPasswordError("");
 if (!currentPassword || !newPassword || !confirmPassword) {
 setPasswordError("Please fill all password fields.");
 return;
 }
 if (newPassword.length < 8) {
 setPasswordError("New password must be at least 8 characters.");
 return;
 }
 if (newPassword !== confirmPassword) {
 setPasswordError("New password and confirmation do not match.");
 return;
 }

 setSavingPassword(true);
 try {
 const res = await fetch("/api/settings/profile/password", {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 current_password: currentPassword,
 new_password: newPassword,
 confirm_password: confirmPassword,
 }),
 });
 if (res.status === 204) {
 setPasswordMessage(copy.passwordUpdated);
 setCurrentPassword("");
 setNewPassword("");
 setConfirmPassword("");
 return;
 }
 const json = (await res.json().catch(() => ({}))) as { message?: string };
 setPasswordError(formatApiResponseError(json, "Password change failed"));
 } catch (e) {
 setPasswordError(e instanceof Error ? e.message : "Password change failed");
 } finally {
 setSavingPassword(false);
 }
 };

 const saveOrganization = async () => {
 if (!orgSettings || !canManageOrg) return;
 setSavingOrg(true);
 setOrgMessage("");
 setOrgError("");
 try {
 const res = await fetch("/api/settings/organization", {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(orgSettings),
 });
 const json = (await res.json().catch(() => ({}))) as {
 settings?: OrganizationSettings;
 message?: string;
 };
 if (!res.ok) {
 setOrgError(formatApiResponseError(json, "Could not save organization settings"));
 return;
 }
 if (json.settings) setOrgSettings(json.settings);
 setOrgMessage("Organization security settings saved.");
 } catch (e) {
 setOrgError(e instanceof Error ? e.message : "Save failed");
 } finally {
 setSavingOrg(false);
 }
 };

 const headerDescription = useMemo(() => {
 if (!displayUser) return copy.defaultDesc;
 if (displayUser.role === "branch_manager") return copy.managerDesc;
 if (displayUser.role === "super_admin") return copy.adminDesc;
 if (displayUser.role === "loan_officer") return copy.officerDesc;
 return copy.defaultDesc;
 }, [displayUser, copy]);

 if (!sessionLoaded || loading) {
 return (
 <>
 <DashboardHeader title={copy.headerTitle} description={copy.headerLoading} />
 <main className="flex-1 p-4 lg:p-6">
 <p className="text-sm text-muted-foreground">{L("Loading settings…")}</p>
 </main>
 </>
 );
 }

 if (!displayUser) {
 return (
 <>
 <DashboardHeader title={copy.headerTitle} description={L("Sign in required")} />
 <main className="flex-1 p-4 lg:p-6">
 <p className="text-sm text-destructive">Could not load your session. Please sign in again.</p>
 </main>
 </>
 );
 }

 return (
 <>
 <DashboardHeader title={copy.headerTitle} description={headerDescription} />
 <main className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pb-10 lg:p-6">
 <div className="mx-auto w-full max-w-7xl space-y-6">
 <div className="rounded-2xl p-4 sm:p-5">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
 <div>
 <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
 {L("Settings")}
 </p>
 <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
 {copy.accountPrefs}
 </h2>
 <p className="mt-1 text-sm text-muted-foreground">
 Password and language use <span className="font-mono">/settings/profile/*</span>. Organization
 policies require elevated permissions.
 </p>
 </div>
 <Badge className="w-fit border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15">
 <ShieldCheck className="mr-1 h-3.5 w-3.5" />
 {L(roleBadgeLabel(displayUser.role))}
 </Badge>
 </div>
 {loadError ? (
 <p className="mt-3 text-sm text-destructive" role="alert">
 {loadError}
 </p>
 ) : null}
 {profilePartial ? (
 <p className="mt-3 text-sm text-amber-700" role="status">
 {L(
 "Profile details loaded from your session. Password and language still save to the server when you apply changes."
 )}
 </p>
 ) : null}
 </div>

 <div className="grid gap-6 xl:grid-cols-3">
 <Card className="border-emerald-100 xl:col-span-1">
 <CardHeader>
 <CardTitle className="inline-flex items-center gap-2">
 <UserRound className="h-4 w-4 text-emerald-700" />
 {L("Profile")}
 </CardTitle>
 <CardDescription>From GET /settings/profile — branch list is scoped to your access.</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
 <div className="flex items-center gap-3">
 <Avatar className="h-12 w-12 ring-2 ring-emerald-200">
 <AvatarFallback className="bg-emerald-600 text-white">
 {(displayUser.full_name || "U")
 .split(/\s+/)
 .filter(Boolean)
 .map((part) => part[0])
 .join("")
 .slice(0, 2) || "U"}
 </AvatarFallback>
 </Avatar>
 <div>
 <p className="font-semibold">{displayUser.full_name}</p>
 <p className="text-xs text-muted-foreground">{displayUser.email}</p>
 </div>
 </div>
 </div>

 <dl className="grid gap-3 rounded-xl border bg-muted/20 p-4 text-sm">
 <div>
 <dt className="text-muted-foreground">{L("Role")}</dt>
 <dd className="mt-0.5 inline-flex items-center gap-1 font-medium capitalize">
 <BadgeCheck className="h-3.5 w-3.5 text-emerald-700" />
 {L(roleLabel(displayUser.role))}
 </dd>
 </div>
 <div>
 <dt className="text-muted-foreground">{L("Employee ID")}</dt>
 <dd className="font-mono">{displayUser.employee_id ?? "—"}</dd>
 </div>
 <div>
 <dt className="text-muted-foreground">{L("Branch")}</dt>
 <dd className="inline-flex items-center gap-1">
 <Building2 className="h-3.5 w-3.5 text-emerald-700" />
 {branchName || displayUser.branch_id || "—"}
 </dd>
 </div>
 <div>
 <dt className="text-muted-foreground">{L("Phone")}</dt>
 <dd>{displayUser.phone ?? "—"}</dd>
 </div>
 <div>
 <dt className="text-muted-foreground">{L("Status")}</dt>
 <dd>
 <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
 {displayUser.is_active !== false ? L("Active") : "Inactive"}
 </Badge>
 </dd>
 </div>
 </dl>
 </CardContent>
 </Card>

 <div className="space-y-6 xl:col-span-2">
 <Card className="border-emerald-100">
 <CardHeader>
 <CardTitle className="inline-flex items-center gap-2">
 <Lock className="h-4 w-4 text-emerald-700" />
 {copy.passwordSection}
 </CardTitle>
 <CardDescription>
 PATCH /settings/profile/password — available to every authenticated role.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid gap-4 sm:grid-cols-3">
 <Field>
 <FieldLabel>{L("Current Password")}</FieldLabel>
 <Input
 type="password"
 autoComplete="current-password"
 value={currentPassword}
 onChange={(e) => setCurrentPassword(e.target.value)}
 />
 </Field>
 <Field>
 <FieldLabel>{L("New Password")}</FieldLabel>
 <Input
 type="password"
 autoComplete="new-password"
 value={newPassword}
 onChange={(e) => setNewPassword(e.target.value)}
 placeholder="Minimum 8 characters"
 />
 </Field>
 <Field>
 <FieldLabel>{L("Confirm Password")}</FieldLabel>
 <Input
 type="password"
 autoComplete="new-password"
 value={confirmPassword}
 onChange={(e) => setConfirmPassword(e.target.value)}
 />
 </Field>
 </div>
 {passwordError ? (
 <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
 {passwordError}
 </p>
 ) : null}
 {passwordMessage ? (
 <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
 {passwordMessage}
 </p>
 ) : null}
 <Button
 className="bg-emerald-600 hover:bg-emerald-700"
 onClick={() => void savePassword()}
 disabled={savingPassword}
 >
 <KeyRound className="mr-2 h-4 w-4" />
 {savingPassword
 ? language === "sw"
 ? "Inasasisha…"
 : "Updating…"
 : L("Update Password")}
 </Button>
 </CardContent>
 </Card>

 <Card className="border-emerald-100">
 <CardHeader>
 <CardTitle className="inline-flex items-center gap-2">
 <Globe className="h-4 w-4 text-emerald-700" />
 {copy.languageSection}
 </CardTitle>
 <CardDescription>
 PATCH /settings/profile/preferences — stored in your user metadata (all roles).
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid gap-4 sm:grid-cols-2">
 <Field>
 <FieldLabel>{L("Language")}</FieldLabel>
 <Select
 value={preferences.language}
 onValueChange={(value) => {
 const lang: AppLanguage = isAppLanguage(value) ? value : "en";
 setPreferences((p) => ({ ...p, language: lang }));
 setLanguage(lang);
 }}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="en">
 <span className="inline-flex items-center gap-2">
 <Globe className="h-3.5 w-3.5" /> {L("English")}
 </span>
 </SelectItem>
 <SelectItem value="sw">
 <span className="inline-flex items-center gap-2">
 <Languages className="h-3.5 w-3.5" /> {L("Kiswahili")}
 </span>
 </SelectItem>
 </SelectContent>
 </Select>
 </Field>
 </div>

 <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
 <div className="flex items-center justify-between gap-4">
 <div>
 <p className="text-sm font-medium">Email security alerts</p>
 <p className="text-xs text-muted-foreground">Notify on new devices and sensitive actions.</p>
 </div>
 <Switch
 checked={preferences.email_alerts}
 onCheckedChange={(checked) =>
 setPreferences((p) => ({ ...p, email_alerts: checked }))
 }
 />
 </div>
 <Separator />
 <div className="flex items-center justify-between gap-4">
 <div>
 <p className="text-sm font-medium">Auto-lock inactive sessions</p>
 <p className="text-xs text-muted-foreground">Lock dashboard after inactivity.</p>
 </div>
 <Switch
 checked={preferences.session_lock_enabled}
 onCheckedChange={(checked) =>
 setPreferences((p) => ({ ...p, session_lock_enabled: checked }))
 }
 />
 </div>
 </div>

 <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4 text-sm">
 <p className="font-medium text-emerald-900">
 {preferences.language === "sw" ? "Muonekano wa lugha" : "Language preview"}
 </p>
 <p className="mt-1 text-emerald-800/90">
 {preferences.language === "sw"
 ? "Karibu kwenye mfumo wa usimamizi wa mikopo wa Falco Financial Services."
 : "Welcome to Falco Financial Services Loan Management System."}
 </p>
 </div>

 {prefsError ? (
 <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
 {prefsError}
 </p>
 ) : null}
 {prefsMessage ? (
 <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
 {prefsMessage}
 </p>
 ) : null}

 <Button
 className="bg-emerald-600 hover:bg-emerald-700"
 onClick={() => void savePreferences()}
 disabled={savingPrefs}
 >
 <Save className="mr-2 h-4 w-4" />
 {savingPrefs
 ? language === "sw"
 ? "Inahifadhi…"
 : "Saving…"
 : copy.savePrefs}
 </Button>
 </CardContent>
 </Card>

 {canViewOrg && orgSettings ? (
 <Card className="border-emerald-100">
 <CardHeader>
 <CardTitle>Organization security</CardTitle>
 <CardDescription>
 {canManageOrg
 ? "PATCH /settings/organization — super admin only (settings.manage)."
 : "Read-only — your role can view but not change organization policies."}
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
 <div className="flex items-center justify-between gap-4">
 <div>
 <p className="text-sm font-medium">Two-factor authentication (org-wide)</p>
 <p className="text-xs text-muted-foreground">Require extra verification for admin sessions.</p>
 </div>
 <Switch
 checked={orgSettings.mfa_enabled}
 disabled={!canManageOrg}
 onCheckedChange={(checked) =>
 setOrgSettings((s) => (s ? { ...s, mfa_enabled: checked } : s))
 }
 />
 </div>
 <Separator />
 <div className="flex items-center justify-between gap-4">
 <div>
 <p className="text-sm font-medium">Default organization language</p>
 <p className="text-xs text-muted-foreground">Fallback when user has no preference.</p>
 </div>
 <Select
 value={orgSettings.language}
 disabled={!canManageOrg}
 onValueChange={(value) =>
 setOrgSettings((s) =>
 s ? { ...s, language: value === "sw" ? "sw" : "en" } : s
 )
 }
 >
 <SelectTrigger className="w-[130px]">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="en">English</SelectItem>
 <SelectItem value="sw">Kiswahili</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 {orgError ? (
 <p className="text-xs text-destructive">{orgError}</p>
 ) : null}
 {orgMessage ? (
 <p className="text-xs text-emerald-700">{orgMessage}</p>
 ) : null}
 {canManageOrg ? (
 <Button
 className="bg-emerald-600 hover:bg-emerald-700"
 onClick={() => void saveOrganization()}
 disabled={savingOrg}
 >
 <Save className="mr-2 h-4 w-4" />
 {savingOrg ? "Saving…" : "Save organization settings"}
 </Button>
 ) : null}
 </CardContent>
 </Card>
 ) : null}
 </div>
 </div>
 </div>
 </main>
 </>
 );
}
