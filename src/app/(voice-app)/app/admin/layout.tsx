import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Platform-staff gate. The admin APIs enforce this independently — this
 * layout only stops a customer seeing the page chrome at all, and returns a
 * 404 rather than a 403 so the panel's existence is not advertised.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "admin") notFound();

  return <>{children}</>;
}
