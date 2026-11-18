import { jsonOk, route } from "@/remit/server/api";
import { PERMISSIONS, requireAdmin } from "@/remit/server/auth";
import {
  getCorridorPerformance,
  getKpis,
  getProviderPerformance,
  getTimeseries,
} from "@/remit/server/analytics-service";
import { providerStatuses } from "@/remit/providers/registry";

export const dynamic = "force-dynamic";

/** GET /api/remit/admin/stats — KPIs, charts and provider health. */
export const GET = route(async () => {
  await requireAdmin(PERMISSIONS.VIEW_TRANSFERS);
  const [kpis, timeseries, corridors, providers] = await Promise.all([
    getKpis(),
    getTimeseries(30),
    getCorridorPerformance(),
    getProviderPerformance(),
  ]);
  return jsonOk({ kpis, timeseries, corridors, providers, integrations: providerStatuses() });
});
