import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email    = process.env.ADMIN_EMAIL;
  const rawPass  = process.env.ADMIN_PASSWORD;
  const name     = process.env.ADMIN_NAME || "Admin";

  if (!email || !rawPass) {
    console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD.");
    console.error("Set them in .env.local (see .env.example) before seeding, e.g.");
    console.error('  ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="choose-a-strong-one" npm run db:seed');
    process.exit(1);
  }
  if (rawPass.length < 12) {
    console.error("ADMIN_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }

  const password = await bcrypt.hash(rawPass, 12);

  const user = await db.user.upsert({
    where:  { email },
    update: { password, name, role: "admin", plan: "enterprise" },
    create: { name, email, password, role: "admin", plan: "enterprise" },
  });

  // Marketplace catalogue is global, not per-user — safe to always ensure it exists.
  const catalogue = [
    { name: "Logistics Intelligence Agent", description: "Route optimization, carrier selection and supply chain visibility.", category: "Logistics",   price: 49, rating: 4.9, installs: 1240, icon: "Truck" },
    { name: "Real Estate AI Assistant",     description: "Property listings, viewing scheduling and buyer qualification.",     category: "Real Estate", price: 59, rating: 4.6, installs: 2100, icon: "Home" },
    { name: "24/7 Customer Support Agent",  description: "Multi-channel support automation across email, chat and voice.",     category: "Support",     price: 39, rating: 4.9, installs: 5600, icon: "Headphones" },
    { name: "Construction Site Manager",    description: "Progress tracking, RAMS documents and subcontractor coordination.",  category: "Construction",price: 69, rating: 4.5, installs: 640,  icon: "HardHat" },
    { name: "Insurance Claims Handler",     description: "First-notice-of-loss intake, triage and policy lookup.",             category: "Insurance",   price: 79, rating: 4.7, installs: 890,  icon: "ShieldCheck" },
    { name: "Content Marketing Agent",      description: "Campaign planning, copywriting and scheduling across channels.",     category: "Marketing",   price: 45, rating: 4.8, installs: 3400, icon: "Megaphone" },
    { name: "Bookkeeping Assistant",        description: "Invoice matching, expense categorisation and month-end prep.",       category: "Finance",     price: 55, rating: 4.4, installs: 1750, icon: "Calculator" },
  ];

  for (const a of catalogue) {
    const existing = await db.marketplaceAgent.findFirst({ where: { name: a.name } });
    if (existing) await db.marketplaceAgent.update({ where: { id: existing.id }, data: a });
    else          await db.marketplaceAgent.create({ data: a });
  }

  // Demo records — only on an otherwise empty account, so re-seeding never duplicates.
  const hasData = await db.contact.count({ where: { userId: user.id } });
  if (hasData === 0 && process.env.SEED_DEMO_DATA !== "false") {
    const contacts = [
      { name: "Sarah Johnson", email: "sarah@techcorp.com",  company: "TechCorp",     stage: "qualified", score: 85 },
      { name: "Michael Chen",  email: "m.chen@startups.io",  company: "Startups.io",  stage: "proposal",  score: 72 },
      { name: "Emma Williams", email: "emma@growthco.com",   company: "GrowthCo",     stage: "lead",      score: 45 },
      { name: "James Murphy",  email: "james@enterprise.ie", company: "Enterprise IE", stage: "won",      score: 95 },
      { name: "Aoife O'Brien", email: "aoife@dublintech.ie", company: "Dublin Tech",  stage: "prospect",  score: 60 },
    ];
    for (const c of contacts) {
      const contact = await db.contact.create({ data: { ...c, userId: user.id } });
      if (c.stage === "won" || c.stage === "proposal") {
        await db.deal.create({
          data: {
            title:     `${c.company} — annual licence`,
            value:     c.stage === "won" ? 12000 : 7500,
            stage:     c.stage === "won" ? "won" : "proposal",
            contactId: contact.id,
          },
        });
      }
    }

    const agents = [
      { name: "Customer Support Agent", type: "customer-support", description: "Handles inbound support tickets", systemPrompt: "You are a friendly, concise customer support agent." },
      { name: "Sales Agent",            type: "sales",            description: "Qualifies inbound leads",         systemPrompt: "You are an expert B2B sales agent. Qualify politely and book meetings." },
    ];
    for (const a of agents) await db.aIAgent.create({ data: { ...a, userId: user.id } });

    const project = await db.project.create({
      data: { name: "Website Redesign", description: "Q3 website refresh", userId: user.id },
    });
    const tasks = [
      { title: "Design new homepage mockup", status: "done",        priority: "high"   },
      { title: "Write copy for about page",  status: "in_progress", priority: "medium" },
      { title: "Set up AI chatbot widget",   status: "todo",        priority: "high"   },
      { title: "SEO optimization pass",      status: "todo",        priority: "low"    },
    ];
    for (const t of tasks) await db.task.create({ data: { ...t, projectId: project.id } });

    console.log("🌱 Demo data created");
  }

  console.log("✅ Seed complete");
  console.log(`📧 Admin account: ${email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
