import { requireTenant } from "@/lib/voice/tenant";
import { ok, badRequest, serverError, parseBody } from "@/lib/voice/http";
import { testCallSchema } from "@/lib/voice/validation";
import { loadCallContext, runTurn } from "@/lib/voice/conversation";
import { isAIConfigured } from "@/lib/voice/ai";
import { hit, limitKey } from "@/lib/voice/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The test console.
 *
 * This runs the *same* engine a real call runs, with `persist: false` so
 * nothing is written to the calendar or the CRM. What an owner hears here is
 * what a caller gets — there is no separate mock path to drift out of sync.
 */
export async function POST(req: Request) {
  const gate = await requireTenant({ permission: "agent.read" });
  if (!gate.ok) return gate.response;

  const limit = hit(limitKey(`voice:test:${gate.ctx.businessId}`, req), 60, 300);
  if (!limit.allowed) {
    return badRequest(`That's a lot of testing. Try again in ${limit.retryAfterSeconds} seconds.`);
  }

  if (!isAIConfigured()) {
    return badRequest(
      "No AI provider is configured yet. Add your AI API key to the environment to test your receptionist."
    );
  }

  const body = await parseBody(req, testCallSchema);
  if (!body.ok) return body.response;

  try {
    const ctx = await loadCallContext(gate.ctx.businessId, body.data.agentId);

    const result = await runTurn({
      ctx,
      history: body.data.history,
      callerSaid: body.data.message,
      persist: false,
      forceAfterHours: body.data.simulateAfterHours,
    });

    return ok({
      reply: result.reply,
      action: result.action,
      toolsUsed: result.toolsUsed,
      knowledgeUsed: result.knowledgeUsed,
      captured: result.captured,
      tokens: result.tokens,
      greeting: ctx.agent.greeting,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("No AI receptionist")) {
      return badRequest(err.message);
    }
    return serverError("test-call", err);
  }
}
