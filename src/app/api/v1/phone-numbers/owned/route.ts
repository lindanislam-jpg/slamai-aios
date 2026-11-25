import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, badRequest, serverError } from "@/lib/voice/http";
import { getVoiceProvider } from "@/lib/voice/providers";

export const runtime = "nodejs";

/** Numbers already on the provider account that no workspace has claimed. */
export async function GET() {
  const gate = await requireTenant({ permission: "phone.write" });
  if (!gate.ok) return gate.response;

  const provider = getVoiceProvider();
  if (!provider.isConfigured()) {
    return badRequest("No telephony provider is connected yet.");
  }

  try {
    const owned = await provider.listOwnedNumbers();
    const claimed = await db.phoneNumber.findMany({
      where: { e164: { in: owned.map((n) => n.e164) } },
      select: { e164: true },
    });
    const claimedSet = new Set(claimed.map((c) => c.e164));

    return ok({ numbers: owned.filter((n) => !claimedSet.has(n.e164)) });
  } catch (err) {
    return serverError("numbers.owned", err);
  }
}
