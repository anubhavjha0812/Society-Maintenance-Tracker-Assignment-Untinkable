import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth`,
  fetchOptions: {
    credentials: "include",
  },
});

export const { useSession, signIn, signOut } = authClient;

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
  societyId: string;
  flatNumber?: string;
  phone?: string;
}) {
  // societyId is a stored user field (additionalFields in auth.ts), but the
  // generated client type doesn't know that's a valid sign-up input, hence
  // the cast — the backend's sign-up `before` hook validates and injects it.
  return authClient.signUp.email(input as unknown as Parameters<typeof authClient.signUp.email>[0]);
}
