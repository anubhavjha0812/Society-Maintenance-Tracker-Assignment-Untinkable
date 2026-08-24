"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { AuthLayout } from "@/components/AuthLayout";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    inviteCode: "",
    flatNumber: "",
    phone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signUpError } = await signUp(form);
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message ?? "Could not register");
      return;
    }
    router.replace("/");
  }

  return (
    <AuthLayout
      eyebrow="Register"
      title="Join your society"
      subtitle="Ask your society admin for the invite code if you don't have one."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-clay hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full name" htmlFor="name">
          <Input id="name" required value={form.name} onChange={(e) => update("name", e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Flat number" htmlFor="flatNumber">
            <Input
              id="flatNumber"
              value={form.flatNumber}
              onChange={(e) => update("flatNumber", e.target.value)}
            />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </Field>
        </div>
        <Field label="Invite code" htmlFor="inviteCode">
          <Input
            id="inviteCode"
            required
            value={form.inviteCode}
            onChange={(e) => update("inviteCode", e.target.value.toUpperCase())}
          />
        </Field>
        {error ? <p className="text-sm text-rose">{error}</p> : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
