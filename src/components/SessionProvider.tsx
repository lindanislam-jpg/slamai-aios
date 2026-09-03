"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

/**
 * `session` is optional on purpose. Passing an explicit `null` tells NextAuth
 * the session is already loaded and empty, so it never fetches and `useSession`
 * reports signed-out forever. Omit it to let the provider fetch on mount.
 */
export default function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return <NextAuthSessionProvider session={session}>{children}</NextAuthSessionProvider>;
}
