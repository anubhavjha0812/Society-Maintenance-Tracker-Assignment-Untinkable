"use client";

import { useCurrentUser } from "@/lib/useCurrentUser";

export default function RootPage() {
  // useCurrentUser handles the redirect to /login or the right home once
  // the session resolves; this page just needs to exist as the target.
  useCurrentUser();
  return null;
}
