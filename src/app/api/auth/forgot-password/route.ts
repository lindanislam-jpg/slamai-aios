import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readJson, badRequest } from "@/lib/api";
import { createResetToken, canSendEmail } from "@/lib/password-reset";

type Body = { email?: string };

/** Same answer whether or not the address exists, so this cannot be used to
 *  discover which emails have accounts. */
const ACKNOWLEDGEMENT = {
  ok: true,
  message: "If an account exists for that email, a reset link has been created.",
};

export async function POST(req: NextRequest) {
  const body = await readJson<Body>(req);
  const email = body?.email?.trim().toLowerCase();
  if (!email) return badRequest("Email is required");

  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return NextResponse.json(ACKNOWLEDGEMENT);

  const { token, expiresInMinutes } = await createResetToken(user.id);

  const base =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    req.nextUrl.origin;
  const link = `${base.replace(/\/$/, "")}/reset-password?token=${token}`;

  if (canSendEmail()) {
    // No mail provider is wired up yet; when one is added, send `link` here.
    console.warn("[forgot-password] mail provider detected but no sender is implemented");
  }

  // Until email delivery exists, the link goes to the server log. On Vercel it
  // is readable under the deployment's Runtime Logs by the account owner.
  console.info(
    `[forgot-password] reset link for ${email} (valid ${expiresInMinutes}m): ${link}`
  );

  return NextResponse.json(ACKNOWLEDGEMENT);
}
