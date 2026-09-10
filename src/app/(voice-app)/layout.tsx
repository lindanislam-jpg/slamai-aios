import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTenantContext, listWorkspaces } from "@/lib/voice/tenant";
import { getVoicePlan } from "@/lib/voice/plans";
import Shell from "@/components/voice/Shell";

/**
 * The authenticated product shell.
 *
 * The guard runs on the server, so an unauthenticated visitor is redirected
 * before any dashboard markup is generated — there is no flash of a signed-in
 * layout, and no protected data is ever rendered for them.
 */
export default async function VoiceAppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const ctx = await getTenantContext();
  if (!ctx) redirect("/voice/new-workspace");

  const [workspaces, user] = await Promise.all([
    listWorkspaces(session.user.id),
    db.user.findUnique({ where: { id: session.user.id }, select: { role: true } }),
  ]);

  return (
    <Shell
      workspaces={workspaces}
      currentWorkspaceId={ctx.businessId}
      businessName={ctx.businessName}
      planName={getVoicePlan(ctx.planId).name}
      userName={ctx.userName}
      userEmail={ctx.userEmail}
      // Read from the database rather than the JWT: a token minted before a
      // demotion would still carry the old claim.
      isPlatformAdmin={user?.role === "admin"}
      suspended={ctx.isSuspended}
    >
      {children}
    </Shell>
  );
}
