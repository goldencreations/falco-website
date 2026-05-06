"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Globe,
  KeyRound,
  Languages,
  Lock,
  MoonStar,
  Save,
  ShieldCheck,
  Sun,
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
import { branches, currentUser } from "@/lib/mock-data";
import {
  type AppLanguage,
  type ThemeMode,
  isAppLanguage,
  isThemeMode,
  LANGUAGE_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "@/lib/preferences";
import { useSessionUser } from "@/lib/use-session-user";

function resolveSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  const finalTheme = mode === "system" ? resolveSystemTheme() : mode;
  html.classList.toggle("dark", finalTheme === "dark");
}

export default function SettingsPage() {
  const { user: sessionUser } = useSessionUser();
  const profileUser = sessionUser ?? currentUser;
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [savingUi, setSavingUi] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uiMessage, setUiMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [sessionLock, setSessionLock] = useState(true);

  const currentBranch = useMemo(
    () => branches.find((branch) => branch.id === profileUser.branch_id),
    [profileUser.branch_id]
  );

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isThemeMode(savedTheme)) {
      setThemeMode(savedTheme);
      applyTheme(savedTheme);
    } else {
      applyTheme("system");
    }
    if (isAppLanguage(savedLanguage)) {
      setLanguage(savedLanguage);
      document.documentElement.setAttribute("lang", savedLanguage === "sw" ? "sw" : "en");
    }
  }, []);

  const savePreferences = async () => {
    setSavingUi(true);
    setUiMessage("");
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    applyTheme(themeMode);
    document.documentElement.setAttribute("lang", language === "sw" ? "sw" : "en");
    await new Promise((resolve) => setTimeout(resolve, 400));
    setSavingUi(false);
    setUiMessage(
      language === "sw"
        ? "Mipangilio imehifadhiwa kwa mafanikio."
        : "Preferences saved successfully."
    );
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
    await new Promise((resolve) => setTimeout(resolve, 550));
    setSavingPassword(false);
    setPasswordMessage("Password updated. Use the new password at your next login.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <>
      <DashboardHeader
        title="Settings"
        description={`${
          profileUser.role === "branch_manager"
            ? "Manager"
            : profileUser.role === "loan_officer"
              ? "Loan officer"
              : "Super admin"
        } account, security controls, and system personalization`}
      />
      <main className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pb-10 lg:p-6">
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-background to-background p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  Management Settings
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">
                  Professional admin configuration workspace
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage profile identity, security posture, theme mode, and language preferences.
                </p>
              </div>
              <Badge className="w-fit border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                {profileUser.role === "branch_manager"
                  ? "Manager Controls"
                  : profileUser.role === "loan_officer"
                    ? "Loan Officer Controls"
                    : "Super Admin Controls"}
              </Badge>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="border-emerald-100 xl:col-span-1">
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Current account overview and access scope.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 ring-2 ring-emerald-200">
                      <AvatarFallback className="bg-emerald-600 text-white">
                        {profileUser.full_name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{profileUser.full_name}</p>
                      <p className="text-xs text-muted-foreground">{profileUser.email}</p>
                    </div>
                  </div>
                </div>

                <dl className="grid gap-3 rounded-xl border bg-muted/20 p-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Role</dt>
                    <dd className="mt-0.5 inline-flex items-center gap-1 font-medium capitalize">
                      <BadgeCheck className="h-3.5 w-3.5 text-emerald-700" />
                      {profileUser.role.replace("_", " ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Employee ID</dt>
                    <dd className="font-mono">{profileUser.employee_id ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Branch</dt>
                    <dd className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 text-emerald-700" />
                      {currentBranch?.name ?? profileUser.branch_id}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd>{profileUser.phone ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>
                      <Badge
                        variant="outline"
                        className="border-emerald-300 bg-emerald-50 text-emerald-700"
                      >
                        {profileUser.is_active ? "Active" : "Inactive"}
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
                    Change Password
                  </CardTitle>
                  <CardDescription>
                    Update your account password using enterprise password rules.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field>
                      <FieldLabel>Current Password</FieldLabel>
                      <Input
                        type="password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        placeholder="Current password"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>New Password</FieldLabel>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="Minimum 8 characters"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Confirm Password</FieldLabel>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Repeat new password"
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
                    onClick={savePassword}
                    disabled={savingPassword}
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    {savingPassword ? "Saving..." : "Update Password"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-emerald-100">
                <CardHeader>
                  <CardTitle className="inline-flex items-center gap-2">
                    <MoonStar className="h-4 w-4 text-emerald-700" />
                    Appearance & Language
                  </CardTitle>
                  <CardDescription>
                    Choose display mode and system language for the dashboard workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>Theme mode</FieldLabel>
                      <Select value={themeMode} onValueChange={(value: ThemeMode) => setThemeMode(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">
                            <span className="inline-flex items-center gap-2">
                              <Sun className="h-3.5 w-3.5" /> Light
                            </span>
                          </SelectItem>
                          <SelectItem value="dark">
                            <span className="inline-flex items-center gap-2">
                              <MoonStar className="h-3.5 w-3.5" /> Dark
                            </span>
                          </SelectItem>
                          <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Language</FieldLabel>
                      <Select
                        value={language}
                        onValueChange={(value: AppLanguage) => setLanguage(value)}
                      >
                        <SelectTrigger>
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
                    </Field>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4 text-sm">
                    <p className="font-medium text-emerald-900">
                      {language === "sw" ? "Muonekano wa lugha" : "Language preview"}
                    </p>
                    <p className="mt-1 text-emerald-800/90">
                      {language === "sw"
                        ? "Karibu kwenye mfumo wa usimamizi wa mikopo wa Falco Financial Services."
                        : "Welcome to Falco Financial Services Loan Management System."}
                    </p>
                  </div>

                  {uiMessage ? (
                    <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      {uiMessage}
                    </p>
                  ) : null}

                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={savePreferences}
                    disabled={savingUi}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {savingUi ? "Saving..." : "Save Preferences"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-emerald-100">
                <CardHeader>
                  <CardTitle>Security & Session Management</CardTitle>
                  <CardDescription>
                    Core controls for super admin account security posture.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Two-factor authentication</p>
                        <p className="text-xs text-muted-foreground">
                          Require extra verification for admin login sessions.
                        </p>
                      </div>
                      <Switch checked={mfaEnabled} onCheckedChange={setMfaEnabled} />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Email security alerts</p>
                        <p className="text-xs text-muted-foreground">
                          Notify on new devices and privilege-sensitive actions.
                        </p>
                      </div>
                      <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Auto-lock inactive sessions</p>
                        <p className="text-xs text-muted-foreground">
                          Lock dashboard after 15 minutes without activity.
                        </p>
                      </div>
                      <Switch checked={sessionLock} onCheckedChange={setSessionLock} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    These controls are currently persisted per browser session for UI preview and can be wired to backend settings endpoints.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
