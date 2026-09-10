import { badRequest, jsonOk, route } from "@/remit/server/api";
import { requireActiveCustomer } from "@/remit/server/auth";
import { getRecipientSchema } from "@/remit/corridors/recipient-schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/remit/recipients/fields?country=ZA&method=BANK_DEPOSIT
 *
 * The fields the payout network needs for this country. The form is built from
 * this, and the same definitions validate the submission server-side, so the
 * two can never drift.
 */
export const GET = route(async (request) => {
  await requireActiveCustomer();
  const url = new URL(request.url);
  const country = url.searchParams.get("country");
  const method = url.searchParams.get("method") ?? "BANK_DEPOSIT";
  if (!country) throw badRequest("A country is required");

  const schema = getRecipientSchema(country.toUpperCase(), method);
  if (!schema) throw badRequest("We do not support that payout method yet");

  return jsonOk({ schema });
});
