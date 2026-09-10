/**
 * The trades and professions SlamAI Voice ships defaults for. Choosing one at
 * signup pre-fills the agent's instructions and the starter service list, so a
 * plumber is never asked to write a system prompt from scratch.
 */

export type Industry = {
  key: string;
  label: string;
  /** Emoji used in the picker — plain text so it needs no icon bundle. */
  icon: string;
  /** Appended to the agent's system prompt. */
  guidance: string;
  /** Seeded into the services step of onboarding. */
  services: { name: string; durationMin: number }[];
  /** Words in a caller's speech that mark the call urgent for this trade. */
  emergencyKeywords: string[];
};

export const INDUSTRIES: Industry[] = [
  {
    key: "plumbing",
    label: "Plumbing",
    icon: "🔧",
    guidance:
      "Callers often have water damage or no heating. Establish urgency early, take the address, and never quote a price for a job you have not seen.",
    services: [
      { name: "Emergency call-out", durationMin: 60 },
      { name: "Boiler repair", durationMin: 90 },
      { name: "Leak detection", durationMin: 60 },
      { name: "Bathroom installation quote", durationMin: 45 },
    ],
    emergencyKeywords: ["leak", "flood", "burst", "no heating", "no hot water", "gas"],
  },
  {
    key: "electrical",
    label: "Electrical",
    icon: "⚡",
    guidance:
      "Treat anything involving sparks, burning smells or a total power loss as urgent and collect the address immediately.",
    services: [
      { name: "Emergency call-out", durationMin: 60 },
      { name: "Fault finding", durationMin: 90 },
      { name: "Rewiring quote", durationMin: 45 },
      { name: "EV charger installation", durationMin: 120 },
    ],
    emergencyKeywords: ["sparks", "burning", "smoke", "no power", "shock", "exposed wire"],
  },
  {
    key: "hvac",
    label: "Heating & air conditioning",
    icon: "🌡️",
    guidance:
      "Ask whether the property currently has heating or cooling. Vulnerable occupants without heating are always urgent.",
    services: [
      { name: "Breakdown call-out", durationMin: 90 },
      { name: "Annual service", durationMin: 60 },
      { name: "New system survey", durationMin: 60 },
    ],
    emergencyKeywords: ["no heating", "no cooling", "carbon monoxide", "gas smell", "elderly"],
  },
  {
    key: "roofing",
    label: "Roofing",
    icon: "🏠",
    guidance:
      "Storm damage and active leaks are urgent. Ask about the property type and how many storeys before booking a survey.",
    services: [
      { name: "Emergency leak repair", durationMin: 90 },
      { name: "Roof survey", durationMin: 60 },
      { name: "Gutter clearance", durationMin: 60 },
    ],
    emergencyKeywords: ["leak", "storm", "tiles off", "water coming in", "collapse"],
  },
  {
    key: "construction",
    label: "Building & construction",
    icon: "🏗️",
    guidance:
      "Most calls are project enquiries. Capture the scope, the site address and the customer's timescale, then book a site visit.",
    services: [
      { name: "Site visit", durationMin: 60 },
      { name: "Extension consultation", durationMin: 60 },
      { name: "Renovation quote", durationMin: 60 },
    ],
    emergencyKeywords: ["structural", "collapse", "unsafe"],
  },
  {
    key: "estate_agency",
    label: "Estate agency",
    icon: "🔑",
    guidance:
      "Find out whether the caller is buying, selling, renting or letting. Capture the property address or the area and budget.",
    services: [
      { name: "Valuation appointment", durationMin: 45 },
      { name: "Property viewing", durationMin: 30 },
      { name: "Landlord consultation", durationMin: 45 },
    ],
    emergencyKeywords: ["no heating", "flood", "break-in", "locked out"],
  },
  {
    key: "dental",
    label: "Dental practice",
    icon: "🦷",
    guidance:
      "Never give clinical advice. Establish whether the caller is in pain or has facial swelling — those are urgent and must be flagged to a human.",
    services: [
      { name: "Check-up", durationMin: 30 },
      { name: "Hygienist", durationMin: 30 },
      { name: "Emergency appointment", durationMin: 30 },
    ],
    emergencyKeywords: ["severe pain", "swelling", "bleeding", "knocked out", "abscess"],
  },
  {
    key: "clinic",
    label: "Clinic & healthcare",
    icon: "🩺",
    guidance:
      "Never give medical advice or discuss test results. If a caller describes a medical emergency, tell them to ring the emergency services and escalate immediately.",
    services: [
      { name: "Consultation", durationMin: 30 },
      { name: "Follow-up", durationMin: 20 },
    ],
    emergencyKeywords: ["chest pain", "breathing", "bleeding", "unconscious", "overdose"],
  },
  {
    key: "salon",
    label: "Salon & beauty",
    icon: "💇",
    guidance:
      "Most calls are bookings or changes. Confirm the service, the stylist if requested, and the time before booking.",
    services: [
      { name: "Cut and finish", durationMin: 60 },
      { name: "Colour", durationMin: 120 },
      { name: "Consultation", durationMin: 15 },
    ],
    emergencyKeywords: [],
  },
  {
    key: "gym",
    label: "Gym & fitness",
    icon: "🏋️",
    guidance:
      "Callers ask about membership, classes and opening hours. Capture new membership enquiries as leads and offer a tour.",
    services: [
      { name: "Gym tour", durationMin: 30 },
      { name: "Personal training consultation", durationMin: 45 },
    ],
    emergencyKeywords: [],
  },
  {
    key: "cleaning",
    label: "Cleaning services",
    icon: "🧽",
    guidance:
      "Capture the property size, the type of clean and how often it is needed. Quote only from the published service list.",
    services: [
      { name: "Domestic clean", durationMin: 120 },
      { name: "End of tenancy clean", durationMin: 240 },
      { name: "Commercial quote visit", durationMin: 45 },
    ],
    emergencyKeywords: ["flood", "biohazard"],
  },
  {
    key: "hospitality",
    label: "Hotel & hospitality",
    icon: "🏨",
    guidance:
      "Handle reservation enquiries, availability questions and guest requests. Confirm dates and party size carefully before booking.",
    services: [
      { name: "Room reservation", durationMin: 15 },
      { name: "Event enquiry", durationMin: 30 },
    ],
    emergencyKeywords: ["fire", "medical", "injury"],
  },
  {
    key: "restaurant",
    label: "Restaurant",
    icon: "🍽️",
    guidance:
      "Take table bookings: date, time, party size and name. Mention dietary requirements are welcome. Never promise a table you have not confirmed.",
    services: [
      { name: "Table booking", durationMin: 90 },
      { name: "Private dining enquiry", durationMin: 30 },
    ],
    emergencyKeywords: [],
  },
  {
    key: "automotive",
    label: "Car dealership & garage",
    icon: "🚗",
    guidance:
      "Find out the vehicle make, model and registration. Separate service bookings from sales enquiries and score sales enquiries as leads.",
    services: [
      { name: "Service booking", durationMin: 60 },
      { name: "MOT / NCT", durationMin: 60 },
      { name: "Test drive", durationMin: 45 },
    ],
    emergencyKeywords: ["broken down", "accident", "crash", "smoke"],
  },
  {
    key: "recruitment",
    label: "Recruitment",
    icon: "💼",
    guidance:
      "Establish whether the caller is a candidate or an employer. Capture the role, sector and location.",
    services: [
      { name: "Candidate registration call", durationMin: 30 },
      { name: "Client briefing", durationMin: 45 },
    ],
    emergencyKeywords: [],
  },
  {
    key: "legal",
    label: "Legal services",
    icon: "⚖️",
    guidance:
      "Never give legal advice or comment on the merits of a case. Take the matter type and contact details and book a consultation with a solicitor.",
    services: [
      { name: "Initial consultation", durationMin: 45 },
      { name: "Case review", durationMin: 60 },
    ],
    emergencyKeywords: ["arrested", "custody", "court tomorrow", "deadline today"],
  },
  {
    key: "security",
    label: "Security services",
    icon: "🛡️",
    guidance:
      "Active alarms and break-ins are urgent. Take the site address and escalate immediately.",
    services: [
      { name: "Site survey", durationMin: 60 },
      { name: "Alarm service", durationMin: 60 },
    ],
    emergencyKeywords: ["break-in", "alarm going off", "intruder", "burglary"],
  },
  {
    key: "professional",
    label: "Professional services",
    icon: "📊",
    guidance:
      "Capture the enquiry type, the company and the caller's role, then book a consultation.",
    services: [
      { name: "Discovery call", durationMin: 30 },
      { name: "Consultation", durationMin: 60 },
    ],
    emergencyKeywords: [],
  },
  {
    key: "other",
    label: "Something else",
    icon: "🏢",
    guidance:
      "Answer from the business's knowledge base, capture the caller's details, and book a callback if you cannot help.",
    services: [{ name: "Consultation", durationMin: 30 }],
    emergencyKeywords: [],
  },
];

export function getIndustry(key: string | null | undefined): Industry {
  return INDUSTRIES.find((i) => i.key === key) ?? INDUSTRIES[INDUSTRIES.length - 1];
}
