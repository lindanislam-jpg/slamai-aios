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

  // Marketplace agents
  const mktAgents = [
    { name: "Logistics Intelligence Agent", description: "Route optimization and supply chain", category: "Logistics",    price: 49,  rating: 4.9, installs: 1240 },
    { name: "Real Estate AI Assistant",     description: "Property listings and buyer qualification", category: "Real Estate", price: 59, rating: 4.6, installs: 2100 },
    { name: "24/7 Customer Support Agent",  description: "Multi-channel support automation",   category: "Support",      price: 39,  rating: 4.9, installs: 5600 },
  ];

  for (const a of mktAgents) {
    await db.marketplaceAgent.create({ data: a });
  }

  console.log("✅ Seed complete");
  console.log(`📧 Admin account: ${ADMIN_EMAIL} (password from SEED_ADMIN_PASSWORD)`);
}

main().catch(console.error).finally(() => db.$disconnect());
