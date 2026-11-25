import { requireTenant } from "@/lib/voice/tenant";
import { ok, badRequest, serverError, queryParam } from "@/lib/voice/http";
import { getVoiceProvider } from "@/lib/voice/providers";

export const runtime = "nodejs";

/** Numbers available to buy from the configured carrier. */
export async function GET(req: Request) {
  const gate = await requireTenant({ permission: "phone.write" });
  if (!gate.ok) return gate.response;

  const provider = getVoiceProvider();
  if (!provider.isConfigured()) {
    return badRequest(
      "No telephony provider is connected yet. Add your provider credentials to buy numbers."
    );
  }

  try {
    const numbers = await provider.searchAvailableNumbers({
      country: queryParam(req, "country") ?? "IE",
      areaCode: queryParam(req, "areaCode") ?? undefined,
      contains: queryParam(req, "contains") ?? undefined,
      limit: 10,
    });
    return ok({ numbers });
  } catch (err) {
    return serverError("numbers.search", err);
  }
}
