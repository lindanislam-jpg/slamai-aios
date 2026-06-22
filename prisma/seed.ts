import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("Admin@1234", 12);

  const user = await db.user.upsert({
    where: { email: "admin@slamai.com" },
    update: {},
    create: {
      name:     "Admin User",
      email:    "admin@slamai.com",
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

  for (const c of contacts) {
    await db.contact.create({ data: { ...c, userId: user.id } });
  }

  // Demo AI agents
  const agents = [
    { name: "Customer Support Agent", type: "customer-support", description: "Handles support tickets", systemPrompt: "You are a friendly customer support agent." },
    { name: "Sales Agent",            type: "sales",            description: "Qualifies leads",        systemPrompt: "You are an expert sales agent." },
  ];

  for (const a of agents) {
    await db.aIAgent.create({ data: { ...a, userId: user.id } });
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
  console.log("📧 Login: admin@slamai.com / Admin@1234");
}

main().catch(console.error).finally(() => db.$disconnect());
