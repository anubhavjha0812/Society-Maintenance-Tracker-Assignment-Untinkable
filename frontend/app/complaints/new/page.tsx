"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { AppShell } from "@/components/AppShell";
import { Field, Input, Textarea, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { api, newIdempotencyKey, type Complaint, type Priority } from "@/lib/api-client";
import { COMPLAINT_CATEGORIES } from "@/lib/categories";

export default function NewComplaintPage() {
  const { user } = useCurrentUser(["resident"]);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState(COMPLAINT_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const complaint = await api.post<Complaint>(
        "/complaints",
        { category, description, priority },
        newIdempotencyKey(),
      );

      const file = fileRef.current?.files?.[0];
      if (file) {
        const presign = await api.post<{ uploadUrl: string; objectStorageKey: string }>(
          "/media/presign",
          { complaintId: complaint.id, contentType: file.type, sizeBytes: file.size },
        );
        await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        await api.post("/media/confirm", {
          complaintId: complaint.id,
          objectStorageKey: presign.objectStorageKey,
          contentType: file.type,
          sizeBytes: file.size,
        });
      }

      router.replace(`/complaints/${complaint.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <AppShell user={user}>
      <h1 className="font-display text-display-sm text-ink">Raise a complaint</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Describe the issue clearly — category and priority help your admin triage it.
      </p>

      <Panel className="mt-6 max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Category" htmlFor="category">
            <Select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {COMPLAINT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" htmlFor="description">
            <Textarea
              id="description"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's wrong, and where?"
            />
          </Field>
          <Field label="Priority" htmlFor="priority">
            <Select id="priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </Select>
          </Field>
          <Field label="Photo (optional)" htmlFor="photo">
            <input
              id="photo"
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="block w-full text-sm text-ink-soft file:mr-3 file:rounded file:border file:border-hairline file:bg-paper file:px-3 file:py-1.5 file:text-sm file:text-ink hover:file:border-ink"
            />
          </Field>
          {error ? <p className="text-sm text-rose">{error}</p> : null}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Submitting…" : "Submit complaint"}
          </Button>
        </form>
      </Panel>
    </AppShell>
  );
}
