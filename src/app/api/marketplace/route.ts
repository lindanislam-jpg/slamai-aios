import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/api";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const [listings, owned] = await Promise.all([
    db.marketplaceAgent.findMany({
      where: { isActive: true },
      orderBy: [{ installs: "desc" }, { name: "asc" }],
    }),
    db.aIAgent.findMany({ where: { userId }, select: { name: true } }),
  ]);

  // An install creates an agent under the same name, so that is what marks a
  // listing as already installed for this user.
  const ownedNames = new Set(owned.map(a => a.name));

  return NextResponse.json(
    listings.map(l => ({
      id: l.id,
      name: l.name,
      description: l.description,
      category: l.category,
      price: l.price,
      rating: l.rating,
      installs: l.installs,
      features: l.features ? l.features.split(",").map(f => f.trim()).filter(Boolean) : [],
      installed: ownedNames.has(l.name),
    }))
  );
}
