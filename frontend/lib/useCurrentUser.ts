"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "./auth-client";
import type { CurrentUser, Role } from "./types";

/**
 * Wraps Better-Auth's session hook, redirecting to /login when there's no
 * session and to the right home when the session's role doesn't match
 * `allow`. This is a UX convenience only — the backend's own RBAC
 * middleware is the actual enforcement boundary (a client redirect can
 * always be bypassed, an API 403 can't).
 */
export function useCurrentUser(allow?: Role[]) {
  const { data, isPending } = useSession();
  const router = useRouter();
  const user = (data?.user as unknown as CurrentUser | undefined) ?? undefined;

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (allow && !allow.includes(user.role)) {
      router.replace(user.role === "resident" ? "/complaints" : "/admin");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, user?.id, user?.role]);

  return { user, isPending };
}
