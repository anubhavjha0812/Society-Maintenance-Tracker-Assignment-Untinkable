"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Landing } from "@/components/Landing";
import type { CurrentUser } from "@/lib/types";

export default function RootPage() {
  // Signed-in visitors get redirected straight to their role's home; signed-
  // out visitors see the public landing page instead of bouncing to /login.
  const { data, isPending } = useSession();
  const user = data?.user as unknown as CurrentUser | undefined;
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace(user.role === "resident" ? "/complaints" : "/admin");
  }, [user, router]);

  if (isPending || user) return null;
  return <Landing />;
}
