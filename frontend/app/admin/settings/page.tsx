"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/ui/Panel";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { api, ApiError, type SocietySettings } from "@/lib/api-client";

export default function AdminSettingsPage() {
  const { user } = useCurrentUser(["society_admin", "super_admin"]);
  const [settings, setSettings] = useState<SocietySettings | null>(null);
  const [days, setDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get<SocietySettings>("/society").then((s) => {
      setSettings(s);
      setDays(String(s.overdueThresholdDays));
    });
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const updated = await api.patch<SocietySettings>("/society/settings", {
        overdueThresholdDays: Number(days),
      });
      setSettings(updated);
      setDays(String(updated.overdueThresholdDays));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <AppShell user={user}>
      <h1 className="font-display text-display-sm text-ink">Settings</h1>
      <p className="mt-1 text-sm text-ink-soft">Configuration for {settings?.name ?? "your society"}.</p>

      <Panel className="mt-6 max-w-md">
        {!settings ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Overdue threshold (days)" htmlFor="overdueThresholdDays">
              <Input
                id="overdueThresholdDays"
                type="number"
                min={1}
                max={90}
                required
                value={days}
                onChange={(e) => {
                  setDays(e.target.value);
                  setSaved(false);
                }}
              />
            </Field>
            <p className="text-xs text-ink-soft">
              An open complaint is flagged overdue once it's been open this many days. Checked by a
              background sweep every few minutes — changes apply on the sweep's next run, not
              instantly.
            </p>
            {error ? <p className="text-sm text-rose">{error}</p> : null}
            {saved ? <p className="text-sm text-moss">Saved.</p> : null}
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </form>
        )}
      </Panel>
    </AppShell>
  );
}
