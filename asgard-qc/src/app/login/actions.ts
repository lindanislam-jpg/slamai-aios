"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { destroySession, login, LoginError, SESSION_COOKIE } from "@/lib/session";

export async function signIn(_prev: { error?: string; email?: string } | null, fd: FormData) {
  const email = String(fd.get("email") ?? "");
  const password = String(fd.get("password") ?? "");
  try {
    const ua = (await headers()).get("user-agent") ?? undefined;
    const { token, expires } = await login(email, password, ua);
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true",
      path: "/",
      expires,
    });
  } catch (err) {
    if (err instanceof LoginError) return { error: err.message, email };
    console.error(err);
    return { error: "Sign-in is unavailable. Check the database connection.", email };
  }
  const next = String(fd.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  const jar = await cookies();
  await destroySession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
