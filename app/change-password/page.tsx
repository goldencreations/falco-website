"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatApiResponseError } from "@/lib/falco-api";

export default function ChangePasswordPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      current_password: String(form.get("current_password") ?? ""),
      new_password: String(form.get("new_password") ?? ""),
      confirm_password: String(form.get("confirm_password") ?? ""),
    };
    try {
      const response = await fetch("/api/settings/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(formatApiResponseError(json, "Password change failed."));
      }
      window.location.assign("/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Password change failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <Card className="w-full max-w-md border-border/80 shadow-sm">
        <CardHeader>
          <div className="mb-3 grid size-10 place-items-center rounded-md bg-foreground text-background">
            <LockKeyhole className="size-5" />
          </div>
          <CardTitle>Set a private password</CardTitle>
          <CardDescription>
            Your temporary password must be replaced before you can enter Falco or the private General Ledger.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2"><Label htmlFor="current_password">Temporary password</Label><Input id="current_password" name="current_password" type="password" autoComplete="current-password" required /></div>
            <div className="space-y-2"><Label htmlFor="new_password">New password</Label><Input id="new_password" name="new_password" type="password" minLength={12} autoComplete="new-password" required /></div>
            <div className="space-y-2"><Label htmlFor="confirm_password">Confirm new password</Label><Input id="confirm_password" name="confirm_password" type="password" minLength={12} autoComplete="new-password" required /></div>
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
            <Button className="w-full" disabled={busy}>{busy ? "Saving…" : "Change password and continue"}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
