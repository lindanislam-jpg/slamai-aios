import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, badRequest } from "@/lib/api";
import { PROVIDERS, isProvider } from "@/lib/integrations";

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const saved = await db.integration.findMany({ where: { userId: gate.userId } });
  const byProvider = new Map(saved.map((i) => [i.provider, i]));

  const integrations = PROVIDERS.map((provider) => {
    const record = byProvider.get(provider);
    return {
      provider,
      status:      record?.status ?? "disconnected",
      accountId:   record?.accountId ?? null,
      connectedAt: record?.updatedAt ?? null,
    };
  });

  return NextResponse.json(integrations);
}

type IntegrationBody = { provider?: string; status?: string; accountId?: string };

export async function POST(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await readJson<IntegrationBody>(req);
  if (!body?.provider) return badRequest("provider is required");
  if (!isProvider(body.provider)) {
    return badRequest(`Unknown provider "${body.provider}"`);
  }

  const status = body.status === "connected" ? "connected" : "disconnected";

  const integration = await db.integration.upsert({
    where:  { userId_provider: { userId: gate.userId, provider: body.provider } },
    update: { status, accountId: body.accountId ?? null },
    create: { userId: gate.userId, provider: body.provider, status, accountId: body.accountId ?? null },
  });

  return NextResponse.json(integration);
}
