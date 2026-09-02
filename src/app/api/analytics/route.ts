import { NextRequest, NextResponse } from "next/server";
import { requireUserId, unauthorized } from "@/lib/api";
import { getAnalytics, parseRange } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const range = parseRange(req.nextUrl.searchParams.get("range"));
  const data = await getAnalytics(userId, range);
  return NextResponse.json(data);
}
