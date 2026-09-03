import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// Credentials come from the environment so no real password lives in the repo.
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || "admin@slamai.local").toLowerCase();
const ADMIN_NAME  = process.env.SEED_ADMIN_NAME || "SlamAI Admin";

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error(
      "SEED_ADMIN_PASSWORD is not set. Export it (and optionally SEED_ADMIN_EMAIL / SEED_ADMIN_NAME) before running db:seed."
    );
  }
  const password = await bcrypt.hash(adminPassword, 12);

  const user = await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { password, name: ADMIN_NAME, role: "admin", plan: "enterprise" },
    create: {
      name:     ADMIN_NAME,
      email:    ADMIN_EMAIL,
      password,
      role:     "admin",
      plan:     "enterprise",
    },
  });

  // The demo workspace is only populated once. Re-running the seed refreshes
  // the admin account and the marketplace catalogue without duplicating a
  // user's contacts, agents and projects — or trampling their own data.
  const existingContacts = await db.contact.count({ where: { userId: user.id } });
  const seedDemoData = existingContacts === 0;

  // Demo contacts
  const contacts = [
    { name: "Sarah Johnson",  email: "sarah@techcorp.com",   company: "TechCorp",    stage: "qualified", score: 85 },
    { name: "Michael Chen",   email: "m.chen@startups.io",   company: "Startups.io", stage: "proposal",  score: 72 },
    { name: "Emma Williams",  email: "emma@growthco.com",    company: "GrowthCo",    stage: "lead",      score: 45 },
    { name: "James Murphy",   email: "james@enterprise.ie",  company: "Enterprise IE",stage: "won",      score: 95 },
    { name: "Aoife O'Brien",  email: "aoife@dublintech.ie",  company: "Dublin Tech",  stage: "prospect",  score: 60 },
  ];

  // Spread demo records over the past months so the analytics charts have a
  // shape to draw rather than a single spike at seed time.
  const monthsAgo = (n: number, day = 12) => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - n, day);
  };

  if (seedDemoData) {
    const createdContacts = [];
    for (let i = 0; i < contacts.length; i++) {
      createdContacts.push(
        await db.contact.create({
          data: { ...contacts[i], userId: user.id, createdAt: monthsAgo(5 - i, 6 + i * 3) },
        })
      );
    }

    // Demo deals, some won across earlier months and some still open.
    const deals = [
      { title: "TechCorp platform rollout", value: 8400,  stage: "won",      closeDate: monthsAgo(4), contactIdx: 0 },
      { title: "Startups.io pilot",         value: 5200,  stage: "won",      closeDate: monthsAgo(3), contactIdx: 1 },
      { title: "GrowthCo retainer",         value: 3600,  stage: "won",      closeDate: monthsAgo(1), contactIdx: 2 },
      { title: "Enterprise IE expansion",   value: 12500, stage: "won",      closeDate: monthsAgo(0), contactIdx: 3 },
      { title: "Dublin Tech automation",    value: 7400,  stage: "proposal", closeDate: null,         contactIdx: 4 },
      { title: "TechCorp phase two",        value: 9800,  stage: "prospect", closeDate: null,         contactIdx: 0 },
    ];

    for (const d of deals) {
      const { contactIdx, ...rest } = d;
      await db.deal.create({
        data: { ...rest, contactId: createdContacts[contactIdx].id, createdAt: rest.closeDate ?? monthsAgo(2) },
      });
    }

    // Demo AI agents
    const agents = [
      { name: "Customer Support Agent", type: "customer-support", description: "Handles support tickets", systemPrompt: "You are a friendly customer support agent." },
      { name: "Sales Agent",            type: "sales",            description: "Qualifies leads",        systemPrompt: "You are an expert sales agent." },
    ];

    const createdAgents = [];
    for (const a of agents) {
      createdAgents.push(await db.aIAgent.create({ data: { ...a, userId: user.id } }));
    }

    // A few conversations so agent-usage analytics is not empty.
    const conversations = [
      { agentIdx: 0, title: "Refund request from a customer",   replies: 6, month: 2 },
      { agentIdx: 0, title: "Shipping delay follow-up",          replies: 4, month: 1 },
      { agentIdx: 1, title: "Qualify inbound lead from website", replies: 5, month: 1 },
      { agentIdx: 1, title: "Pricing questions for enterprise",  replies: 3, month: 0 },
    ];

    for (const c of conversations) {
      const at = monthsAgo(c.month, 14);
      const conv = await db.conversation.create({
        data: { title: c.title, agentId: createdAgents[c.agentIdx].id, userId: user.id, createdAt: at },
      });
      for (let i = 0; i < c.replies; i++) {
        await db.message.create({
          data: {
            role: i % 2 === 0 ? "user" : "assistant",
            content: i % 2 === 0 ? "Demo question" : "Demo assistant reply",
            conversationId: conv.id,
            createdAt: new Date(at.getTime() + i * 60_000),
          },
        });
      }
    }

    // Demo project
    const project = await db.project.create({
      data: { name: "Website Redesign", description: "Q3 website refresh", userId: user.id },
    });

    const tasks = [
      { title: "Design new homepage mockup", status: "done",        priority: "high"   },
      { title: "Write copy for about page",  status: "in_progress", priority: "medium" },
      { title: "Set up AI chatbot widget",   status: "todo",        priority: "high"   },
      { title: "SEO optimization pass",      status: "todo",        priority: "low"    },
    ];

    for (const t of tasks) {
      await db.task.create({ data: { ...t, projectId: project.id } });
    }
  } else {
    console.log("↷ Demo workspace data already present — leaving it untouched.");
  }

  // Marketplace catalogue. Upserted by name so re-seeding does not duplicate
  // listings or reset their install counts.
  const mktAgents = [
    {
      name: "Logistics Intelligence Agent", category: "Logistics", agentType: "operations",
      description: "Route optimization, delivery tracking, fleet management, and supply chain automation.",
      features: "Route optimization,ETA predictions,Driver notifications,Shipment tracking",
      systemPrompt: "You are a logistics and supply chain specialist. Optimize routes, predict delivery times, and keep fleets and shipments running efficiently.",
      price: 49, rating: 4.9, installs: 1240,
    },
    {
      name: "Construction Site Manager", category: "Construction", agentType: "operations",
      description: "Site progress tracking, safety checks, resource allocation, and project reporting.",
      features: "Daily reports,Safety compliance,Material tracking,Subcontractor management",
      systemPrompt: "You are a construction site manager. Track progress, enforce safety compliance, allocate resources, and produce clear daily reports.",
      price: 79, rating: 4.7, installs: 890,
    },
    {
      name: "Insurance Claims Agent", category: "Insurance", agentType: "operations",
      description: "Process claims, assess risks, answer policy questions, and generate quote comparisons.",
      features: "Claims processing,Risk assessment,Policy lookup,Quote generation",
      systemPrompt: "You are an insurance claims specialist. Process claims accurately, assess risk, and explain policy terms in plain language.",
      price: 99, rating: 4.8, installs: 654,
    },
    {
      name: "Real Estate AI Assistant", category: "Real Estate", agentType: "sales",
      description: "Property listings, buyer qualification, appointment booking, and market analysis.",
      features: "Lead qualification,Property search,Appointment booking,Market analysis",
      systemPrompt: "You are a real estate assistant. Qualify buyers, match them to listings, book viewings, and summarize local market conditions.",
      price: 59, rating: 4.6, installs: 2100,
    },
    {
      name: "24/7 Customer Support Agent", category: "Support", agentType: "customer-support",
      description: "Handle support tickets, FAQs, and escalations across email, chat, and voice.",
      features: "Multi-channel support,FAQ automation,Escalation routing,CSAT tracking",
      systemPrompt: "You are a friendly, tireless customer support agent. Resolve issues on first contact where possible and escalate cleanly when not.",
      price: 39, rating: 4.9, installs: 5600,
    },
    {
      name: "Social Media Manager", category: "Marketing", agentType: "marketing",
      description: "Content creation, scheduling, engagement monitoring, and performance reporting.",
      features: "Content creation,Auto-posting,Engagement tracking,Analytics reports",
      systemPrompt: "You are a social media manager. Write scroll-stopping content, plan a posting calendar, and report on what actually performed.",
      price: 49, rating: 4.5, installs: 1890,
    },
    {
      name: "Accounting & Finance Bot", category: "Finance", agentType: "finance",
      description: "Invoice generation, expense tracking, financial reports, and tax preparation.",
      features: "Invoice generation,Expense tracking,P&L reports,Tax preparation",
      systemPrompt: "You are a finance and accounting specialist. Produce invoices, track expenses, and explain financial position precisely.",
      price: 69, rating: 4.7, installs: 1120,
    },
  ];

  for (const a of mktAgents) {
    await db.marketplaceAgent.upsert({
      where: { name: a.name },
      update: { ...a, installs: undefined },
      create: a,
    });
  }

  console.log("✅ Seed complete");
  console.log(`📧 Admin account: ${ADMIN_EMAIL} (password from SEED_ADMIN_PASSWORD)`);
}

main().catch(console.error).finally(() => db.$disconnect());
