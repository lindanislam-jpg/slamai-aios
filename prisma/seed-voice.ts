/**
 * Seeds a fully populated SlamAI Voice demo workspace.
 *
 *   npm run db:seed:voice
 *
 * Creates "ABC Plumbing" with realistic calls, transcripts, leads,
 * appointments and 60 days of usage, so the dashboard looks like a real
 * business rather than an empty shell when you demo it.
 *
 * Everything it creates is flagged `isDemo`, and running it again replaces the
 * previous demo workspace rather than stacking duplicates.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@slamai.io";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "SlamAIDemo2026!";
const DEMO_SLUG = "abc-plumbing-demo";

type ScriptTurn = { role: "caller" | "agent"; text: string };

type CallScript = {
  from: string;
  customerName: string;
  outcome: string;
  summary: string;
  intent: string;
  sentiment: string;
  score: number;
  urgency: string;
  service: string | null;
  emergency: boolean;
  transferred: boolean;
  booksAppointment: boolean;
  durationSec: number;
  estimatedValue: number | null;
  turns: ScriptTurn[];
};

const SCRIPTS: CallScript[] = [
  {
    from: "+353871234501",
    customerName: "Sarah Byrne",
    outcome: "booked",
    summary:
      "Customer called about an emergency boiler failure with no heating and a young baby in the house. Address collected and an engineer booked for the same afternoon. Lead classified as HIGH PRIORITY.",
    intent: "book",
    sentiment: "positive",
    score: 94,
    urgency: "emergency",
    service: "Boiler repair",
    emergency: true,
    transferred: false,
    booksAppointment: true,
    durationSec: 168,
    estimatedValue: 320,
    turns: [
      { role: "agent", text: "Hi, thanks for calling ABC Plumbing. I'm the AI assistant here — how can I help you today?" },
      { role: "caller", text: "Hi, my boiler has stopped working." },
      { role: "agent", text: "I'm sorry to hear that. I can help get this sorted. Is this an emergency, and are you currently without heating?" },
      { role: "caller", text: "Yes, there's no heat at all and I've a small baby in the house." },
      { role: "agent", text: "Understood, I'll treat this as urgent. Can I take your name and address so we can get someone out to you?" },
      { role: "caller", text: "Sarah Byrne, 14 Ashfield Road, Dublin 6." },
      { role: "agent", text: "Thanks Sarah. I have an engineer free at half four this afternoon. Shall I book that in for you?" },
      { role: "caller", text: "Yes please, that would be brilliant." },
      { role: "agent", text: "That's booked for half four today. You'll get a confirmation shortly. Anything else I can help with?" },
      { role: "caller", text: "No, that's great, thank you." },
      { role: "agent", text: "You're very welcome. Someone will be with you this afternoon. Take care." },
    ],
  },
  {
    from: "+353871234502",
    customerName: "Michael O'Connor",
    outcome: "lead_captured",
    summary:
      "Customer enquired about a full bathroom installation for a house in Rathmines. Wanted a rough price; the AI explained a site visit is needed to quote and took his details for a callback.",
    intent: "quote",
    sentiment: "neutral",
    score: 78,
    urgency: "normal",
    service: "Bathroom installation quote",
    emergency: false,
    transferred: false,
    booksAppointment: false,
    durationSec: 142,
    estimatedValue: 4200,
    turns: [
      { role: "agent", text: "Hi, thanks for calling ABC Plumbing. I'm the AI assistant here — how can I help you today?" },
      { role: "caller", text: "I'm looking to get a full bathroom done. What would that cost?" },
      { role: "agent", text: "Happy to help with that. Bathroom installations are priced after a site visit, so I can't give you a figure over the phone. Whereabouts is the property?" },
      { role: "caller", text: "Rathmines, it's a three-bed terrace." },
      { role: "agent", text: "Perfect. Can I take your name and a number, and one of the team will call you back to arrange a visit?" },
      { role: "caller", text: "Michael O'Connor, this number is fine." },
      { role: "agent", text: "Thanks Michael, I've got that. Someone will be in touch within the working day to arrange the visit." },
    ],
  },
  {
    from: "+353871234503",
    customerName: "Emma Walsh",
    outcome: "transferred",
    summary:
      "Customer was unhappy about a previous visit and asked to speak to a manager. The AI apologised, took a brief summary and transferred the call to the office line.",
    intent: "complaint",
    sentiment: "negative",
    score: 32,
    urgency: "urgent",
    service: null,
    emergency: false,
    transferred: true,
    booksAppointment: false,
    durationSec: 74,
    estimatedValue: null,
    turns: [
      { role: "agent", text: "Hi, thanks for calling ABC Plumbing. I'm the AI assistant here — how can I help you today?" },
      { role: "caller", text: "Someone came out on Tuesday and the leak is back. I want to speak to a manager." },
      { role: "agent", text: "I'm sorry, that shouldn't have happened. I'll put you through to someone now — one moment please." },
    ],
  },
  {
    from: "+353871234504",
    customerName: "Liam Kelly",
    outcome: "info_only",
    summary:
      "Customer asked whether the business covers Kildare and what the call-out fee is. Both answered from the knowledge base. No follow-up needed.",
    intent: "enquiry",
    sentiment: "positive",
    score: 41,
    urgency: "browsing",
    service: null,
    emergency: false,
    transferred: false,
    booksAppointment: false,
    durationSec: 58,
    estimatedValue: null,
    turns: [
      { role: "agent", text: "Hi, thanks for calling ABC Plumbing. I'm the AI assistant here — how can I help you today?" },
      { role: "caller", text: "Do you cover Kildare? And what's your call-out charge?" },
      { role: "agent", text: "We do cover Kildare, yes. The call-out fee is sixty euro, and that comes off the bill if you go ahead with the work." },
      { role: "caller", text: "Grand, thanks. I'll ring back if I need you." },
      { role: "agent", text: "No problem at all. Thanks for calling." },
    ],
  },
  {
    from: "+353871234505",
    customerName: "Niamh Doyle",
    outcome: "message_taken",
    summary:
      "Out-of-hours call about a dripping tap. Not urgent, so the AI took a message and the caller's number for a callback in the morning.",
    intent: "enquiry",
    sentiment: "neutral",
    score: 52,
    urgency: "normal",
    service: "Leak detection",
    emergency: false,
    transferred: false,
    booksAppointment: false,
    durationSec: 66,
    estimatedValue: 140,
    turns: [
      { role: "agent", text: "Hi, thanks for calling ABC Plumbing. I'm the AI assistant here — how can I help you today?" },
      { role: "caller", text: "There's a tap dripping in the kitchen, it's not urgent." },
      { role: "agent", text: "Thanks for letting us know. We're closed at the moment, so I'll take your details and someone will call you back in the morning. Can I take your name and number?" },
      { role: "caller", text: "Niamh Doyle, you have my number there." },
      { role: "agent", text: "Perfect, Niamh. Someone will ring you first thing. Have a good evening." },
    ],
  },
  {
    from: "+353871234506",
    customerName: "Peter Nolan",
    outcome: "booked",
    summary:
      "Customer booked an annual boiler service for next week. Straightforward booking with no complications.",
    intent: "book",
    sentiment: "positive",
    score: 71,
    urgency: "normal",
    service: "Boiler repair",
    emergency: false,
    transferred: false,
    booksAppointment: true,
    durationSec: 96,
    estimatedValue: 120,
    turns: [
      { role: "agent", text: "Hi, thanks for calling ABC Plumbing. I'm the AI assistant here — how can I help you today?" },
      { role: "caller", text: "I want to book the boiler service, it's due." },
      { role: "agent", text: "Of course. I have Tuesday morning at ten, or Thursday afternoon at two. Which suits you better?" },
      { role: "caller", text: "Tuesday morning is fine." },
      { role: "agent", text: "Booked for Tuesday at ten. Can I take your name?" },
      { role: "caller", text: "Peter Nolan." },
      { role: "agent", text: "Thanks Peter, that's all set. See you Tuesday." },
    ],
  },
];

const KNOWLEDGE = [
  {
    title: "About ABC Plumbing",
    type: "text",
    text: `ABC Plumbing is a family-run plumbing and heating firm based in Dublin, trading since 2009.
We cover Dublin, Kildare and Meath. We are Gas Safe registered and all engineers are fully insured.
We do not work on commercial boilers or industrial systems.
Our emergency cover runs from 7am to 11pm, seven days a week.
Standard working hours are Monday to Friday 8am to 6pm, and Saturday 9am to 1pm.`,
  },
  {
    title: "Pricing and fees",
    type: "text",
    text: `The call-out fee is €60. It comes off the final bill if the customer proceeds with the work.
Boiler repair is quoted after diagnosis; typical repairs run between €120 and €400 depending on parts.
An annual boiler service is €120 including the safety check.
Bathroom installations are always quoted after a site visit — never quote a bathroom price over the phone.
Emergency call-outs outside working hours carry a €40 surcharge on top of the call-out fee.`,
  },
  {
    title: "Common questions",
    type: "faq",
    text: `Question: Do you charge a call-out fee?
Answer: Yes, €60, and it comes off the bill if you go ahead with the work.

Question: How quickly can you get to an emergency?
Answer: For a genuine emergency inside our coverage area we aim to be with you within four hours during emergency cover hours.

Question: Do you cover Kildare?
Answer: Yes. We cover Dublin, Kildare and Meath.

Question: Are you Gas Safe registered?
Answer: Yes, and all our engineers are fully insured.

Question: Do you work on commercial boilers?
Answer: No, we only work on domestic systems.`,
  },
];

async function main() {
  console.log("Seeding the SlamAI Voice demo workspace…");

  // Remove any previous demo so re-running is safe and idempotent.
  const previous = await db.business.findUnique({ where: { slug: DEMO_SLUG } });
  if (previous) {
    await db.business.delete({ where: { id: previous.id } });
    console.log("  Removed the previous demo workspace.");
  }

  const user = await db.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: "Demo Owner",
      password: await bcrypt.hash(DEMO_PASSWORD, 12),
      company: "ABC Plumbing",
    },
  });

  const business = await db.business.create({
    data: {
      name: "ABC Plumbing",
      slug: DEMO_SLUG,
      industry: "plumbing",
      description:
        "Family-run plumbing and heating firm covering Dublin, Kildare and Meath since 2009. Gas Safe registered.",
      website: "https://example.com",
      email: DEMO_EMAIL,
      phone: "+35315550100",
      city: "Dublin",
      country: "IE",
      timezone: "Europe/Dublin",
      currency: "EUR",
      isDemo: true,
      onboardingCompleted: true,
      onboardingStep: 6,
      memberships: { create: { userId: user.id, role: "owner", isDefault: false } },
      subscription: {
        create: {
          planId: "business",
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 21 * 24 * 60 * 60_000),
        },
      },
      businessHours: {
        create: [
          { weekday: 0, isOpen: false, opensAt: "09:00", closesAt: "17:00" },
          { weekday: 1, isOpen: true, opensAt: "08:00", closesAt: "18:00" },
          { weekday: 2, isOpen: true, opensAt: "08:00", closesAt: "18:00" },
          { weekday: 3, isOpen: true, opensAt: "08:00", closesAt: "18:00" },
          { weekday: 4, isOpen: true, opensAt: "08:00", closesAt: "18:00" },
          { weekday: 5, isOpen: true, opensAt: "08:00", closesAt: "18:00" },
          { weekday: 6, isOpen: true, opensAt: "09:00", closesAt: "13:00" },
        ],
      },
      services: {
        create: [
          { name: "Emergency call-out", price: null, priceNote: "€60 call-out, work quoted on site", durationMin: 60, sortOrder: 0 },
          { name: "Boiler repair", price: null, priceNote: "Quoted after diagnosis, typically €120–€400", durationMin: 90, sortOrder: 1 },
          { name: "Annual boiler service", price: 120, durationMin: 60, sortOrder: 2 },
          { name: "Leak detection", price: 140, durationMin: 60, sortOrder: 3 },
          { name: "Bathroom installation quote", price: null, priceNote: "Free site visit, quoted afterwards", durationMin: 45, sortOrder: 4 },
        ],
      },
    },
    include: { services: true },
  });

  const agent = await db.receptionAgent.create({
    data: {
      businessId: business.id,
      name: "Sarah — AI Receptionist",
      personality: "warm",
      voice: "Polly.Niamh-Neural",
      language: "en-GB",
      greeting: "Hi, thanks for calling ABC Plumbing. I'm the AI assistant here — how can I help you today?",
      customInstructions:
        "Be warm and reassuring — most people ringing us have water where it shouldn't be. Never quote a price for a job we haven't seen. We don't work on commercial boilers.",
      emergencyInstructions:
        "Take their name, address and phone number immediately, tell them we aim to be with them within four hours, then flag the call as urgent.",
      transferEnabled: true,
      transferNumber: "+35315550101",
      transferTriggers: JSON.stringify(["asks_for_human", "angry", "emergency", "high_value"]),
      afterHoursMode: "message",
      isActive: true,
      isDefault: true,
    },
  });

  const phoneNumber = await db.phoneNumber.create({
    data: {
      businessId: business.id,
      e164: "+35315550199",
      label: "Demo line",
      provider: "twilio",
      status: "active",
      agentId: agent.id,
      forwardTo: "+35315550101",
    },
  });

  for (const source of KNOWLEDGE) {
    const created = await db.knowledgeSource.create({
      data: {
        businessId: business.id,
        title: source.title,
        type: source.type,
        rawText: source.text,
        bytes: source.text.length,
        status: "ready",
        lastIndexedAt: new Date(),
      },
    });

    // Passages are stored without embeddings; retrieval falls back to keyword
    // search, so the demo works with no AI key configured.
    const passages = source.text.split(/\n\n+/).filter((p) => p.trim().length > 20);
    await db.knowledgeChunk.createMany({
      data: passages.map((content, ordinal) => ({
        businessId: business.id,
        sourceId: created.id,
        ordinal,
        content: content.trim(),
        tokens: Math.ceil(content.length / 4),
        embedding: [],
      })),
    });
    await db.knowledgeSource.update({
      where: { id: created.id },
      data: { chunkCount: passages.length },
    });
  }

  // 60 days of history, weighted so recent days look busier.
  const now = Date.now();
  let totalCalls = 0;

  for (let dayOffset = 59; dayOffset >= 0; dayOffset--) {
    const callsToday = dayOffset === 0 ? 6 : 2 + Math.floor(pseudoRandom(dayOffset) * 6);

    for (let i = 0; i < callsToday; i++) {
      const script = SCRIPTS[(dayOffset * 3 + i) % SCRIPTS.length];
      const startedAt = new Date(
        now - dayOffset * 24 * 60 * 60_000 - (2 + i) * 55 * 60_000
      );
      const afterHours = startedAt.getHours() < 8 || startedAt.getHours() >= 18;

      const customer = await db.customer.upsert({
        where: { businessId_phone: { businessId: business.id, phone: script.from } },
        update: {},
        create: {
          businessId: business.id,
          name: script.customerName,
          phone: script.from,
        },
      });

      const call = await db.voiceCall.create({
        data: {
          businessId: business.id,
          agentId: agent.id,
          phoneNumberId: phoneNumber.id,
          providerCallId: `DEMO${dayOffset}-${i}-${Math.random().toString(36).slice(2, 9)}`,
          provider: "demo",
          fromNumber: script.from,
          toNumber: phoneNumber.e164,
          direction: "inbound",
          status: "completed",
          outcome: script.outcome,
          aiHandled: !script.transferred,
          transferred: script.transferred,
          afterHours,
          isEmergency: script.emergency,
          durationSec: script.durationSec,
          startedAt,
          endedAt: new Date(startedAt.getTime() + script.durationSec * 1000),
          summary: script.summary,
          intent: script.intent,
          sentiment: script.sentiment,
          customerId: customer.id,
          aiTokens: 600 + script.turns.length * 90,
          turns: {
            create: script.turns.map((turn, index) => ({
              role: turn.role,
              text: turn.text,
              offsetSec: Math.round((index / script.turns.length) * script.durationSec),
            })),
          },
        },
      });

      if (script.outcome !== "info_only") {
        await db.lead.create({
          data: {
            businessId: business.id,
            customerId: customer.id,
            callId: call.id,
            name: script.customerName,
            phone: script.from,
            serviceRequested: script.service,
            summary: script.summary,
            score: script.score,
            status: script.booksAppointment ? "booked" : dayOffset < 5 ? "new" : "contacted",
            source: "voice_call",
            urgency: script.urgency,
            estimatedValue: script.estimatedValue,
            createdAt: startedAt,
            lastInteractionAt: startedAt,
          },
        });
      }

      if (script.booksAppointment) {
        const service = business.services.find((s) => s.name === script.service) ?? business.services[0];
        // Book into working hours a couple of days after the call.
        const startsAt = new Date(startedAt.getTime() + 2 * 24 * 60 * 60_000);
        startsAt.setHours(9 + (i % 7), 0, 0, 0);

        await db.appointment.create({
          data: {
            businessId: business.id,
            customerId: customer.id,
            serviceId: service.id,
            callId: call.id,
            title: `${service.name} — ${script.customerName}`,
            startsAt,
            endsAt: new Date(startsAt.getTime() + service.durationMin * 60_000),
            status: startsAt.getTime() < now ? "completed" : "confirmed",
            createdAt: startedAt,
          },
        });
      }

      const period = `${startedAt.getUTCFullYear()}-${String(startedAt.getUTCMonth() + 1).padStart(2, "0")}`;
      await db.usageEvent.createMany({
        data: [
          { businessId: business.id, metric: "calls", quantity: 1, period, refId: call.id, createdAt: startedAt },
          {
            businessId: business.id,
            metric: "voice_minutes",
            quantity: Math.max(1, Math.ceil(script.durationSec / 60)),
            period,
            refId: call.id,
            createdAt: startedAt,
          },
          { businessId: business.id, metric: "ai_tokens", quantity: 600 + script.turns.length * 90, period, refId: call.id, createdAt: startedAt },
        ],
      });

      totalCalls++;
    }
  }

  await db.notificationRule.createMany({
    data: [
      { businessId: business.id, event: "lead.created", channel: "email", target: DEMO_EMAIL },
      { businessId: business.id, event: "call.emergency", channel: "email", target: DEMO_EMAIL },
      { businessId: business.id, event: "appointment.booked", channel: "email", target: DEMO_EMAIL },
    ],
  });

  await db.auditLog.createMany({
    data: [
      { businessId: business.id, userId: user.id, action: "workspace.created", entityType: "business", entityId: business.id },
      { businessId: business.id, userId: user.id, action: "agent.activated", entityType: "agent", entityId: agent.id },
      { businessId: business.id, userId: user.id, action: "phone.connected", entityType: "phone_number", entityId: phoneNumber.id },
      { businessId: business.id, userId: user.id, action: "onboarding.completed" },
    ],
  });

  console.log(`\nDemo workspace ready.`);
  console.log(`  Sign in:  ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Calls:    ${totalCalls}`);
  console.log(`  Workspace: ABC Plumbing (flagged as a demo in the dashboard)\n`);
}

/** Deterministic pseudo-randomness, so a reseed produces the same shape. */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

main()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
