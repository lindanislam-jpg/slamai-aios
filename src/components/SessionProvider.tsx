"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

/**
 * `session` is intentionally optional and must stay undefined unless a real
 * session object is available. next-auth treats *any* defined value — `null`
 * included — as "the session is already known", so it skips the initial fetch
 * and reports `unauthenticated` forever.
 */
export default function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session;
}) {
  return <NextAuthSessionProvider session={session}>{children}</NextAuthSessionProvider>;
}
