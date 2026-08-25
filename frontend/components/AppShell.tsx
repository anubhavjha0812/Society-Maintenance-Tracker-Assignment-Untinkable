"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import type { CurrentUser } from "@/lib/types";

const RESIDENT_LINKS = [
  { href: "/complaints", label: "My complaints" },
  { href: "/complaints/new", label: "New complaint" },
  { href: "/notices", label: "Notices" },
];

const ADMIN_LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/complaints", label: "Complaints" },
  { href: "/admin/notices", label: "Notices" },
  { href: "/admin/residents", label: "Residents" },
  { href: "/admin/settings", label: "Settings" },
];

export function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const links = user.role === "resident" ? RESIDENT_LINKS : ADMIN_LINKS;

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-hairline bg-paper-raised">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <span className="font-display text-lg italic text-ink">Maintain</span>
            <nav className="flex items-center gap-1">
              {links.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded px-2.5 py-1.5 text-sm transition-colors ${
                      active ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right leading-tight">
              <p className="text-sm text-ink">{user.name}</p>
              <p className="text-xs text-ink-faint">
                {user.role === "resident" ? "Resident" : "Admin"}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded p-1.5 text-ink-soft transition-colors hover:text-ink"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
