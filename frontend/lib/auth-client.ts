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
  inviteCode: string;
  flatNumber?: string;
  phone?: string;
}) {
  // `inviteCode` isn't a stored user field (so it isn't declared in the
  // backend's additionalFields), only a transient input the backend's
  // sign-up `before` hook reads to resolve societyId — the generated
  // client type doesn't know about it, hence the cast.
  return authClient.signUp.email(input as unknown as Parameters<typeof authClient.signUp.email>[0]);
}
