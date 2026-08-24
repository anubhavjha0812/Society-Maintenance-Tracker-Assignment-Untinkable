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
  const sessionUser = (data?.user as unknown as CurrentUser | undefined) ?? undefined;
  const authorized = !!sessionUser && (!allow || allow.includes(sessionUser.role));

  useEffect(() => {
    if (isPending) return;
    if (!sessionUser) {
      router.replace("/login");
      return;
    }
    if (allow && !allow.includes(sessionUser.role)) {
      router.replace(sessionUser.role === "resident" ? "/complaints" : "/admin");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, sessionUser?.id, sessionUser?.role]);

  // Every page guards on `if (!user) return null` — returning undefined
  // here for a role mismatch (not just a missing session) means that
  // same guard also blocks rendering/data-fetching for the one tick
  // before the redirect above actually navigates away, instead of an
  // admin page's chrome and its data fetch briefly firing for a
  // resident who navigated straight to an admin URL.
  return { user: authorized ? sessionUser : undefined, isPending };
}
