import { db } from "@/lib/db";
import { jsonOk, route } from "@/remit/server/api";
import { PERMISSIONS, requireAdmin } from "@/remit/server/auth";
import { serializeCorridor } from "@/remit/server/serialize";

export const dynamic = "force-dynamic";

/** GET /api/remit/admin/corridors — every corridor, active or not. */
export const GET = route(async () => {
  await requireAdmin(PERMISSIONS.MANAGE_CORRIDORS);
  const corridors = await db.remitCorridor.findMany({
    include: { sourceCountry: true, destCountry: true, paymentOptions: true, payoutOptions: true },
    orderBy: { createdAt: "asc" },
  });
  return jsonOk({
    corridors: corridors.map((corridor) => ({
      ...serializeCorridor(corridor),
      isActive: corridor.isActive,
      fxProviderKey: corridor.fxProviderKey,
      payoutProviderKey: corridor.payoutProviderKey,
    })),
  });
});
