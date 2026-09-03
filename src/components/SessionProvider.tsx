"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

/**
 * `session` must stay undefined unless a real session object is available.
 * next-auth treats any defined value — `null` included — as "the session is
 * already known", so it skips the initial fetch and reports `unauthenticated`
 * forever, which sends every dashboard visit back to /login.
 */
export default function SessionProvider({ children, session }: { children: React.ReactNode; session?: Session }) {
  return <NextAuthSessionProvider session={session}>{children}</NextAuthSessionProvider>;
}
