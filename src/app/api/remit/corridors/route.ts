import { db } from "@/lib/db";
import { jsonOk, route } from "@/remit/server/api";
import { serializeCorridor } from "@/remit/server/serialize";

export const dynamic = "force-dynamic";

/**
 * GET /api/remit/corridors
 * The routes we support, with limits and available methods. Public — the
 * landing page uses it, so nothing customer-specific is returned.
 */
export const GET = route(async () => {
  const corridors = await db.remitCorridor.findMany({
    where: { isActive: true },
    include: { sourceCountry: true, destCountry: true, paymentOptions: true, payoutOptions: true },
    orderBy: { createdAt: "asc" },
  });

  return jsonOk({ corridors: corridors.map(serializeCorridor) });
});
