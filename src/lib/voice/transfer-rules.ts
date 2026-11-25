/** The conditions under which the AI hands a call to a person. */

export type TransferTrigger = {
  key: string;
  label: string;
  description: string;
  /** How the condition is described to the model. */
  instruction: string;
};

export const TRANSFER_TRIGGERS: TransferTrigger[] = [
  {
    key: "asks_for_human",
    label: "Caller asks for a person",
    description: "The caller explicitly asks to speak to someone.",
    instruction: "the caller asks to speak to a human, a manager, or a specific person",
  },
  {
    key: "angry",
    label: "Caller is upset or angry",
    description: "The caller is frustrated, angry or complaining.",
    instruction: "the caller is angry, upset, or making a complaint",
  },
  {
    key: "emergency",
    label: "Emergency",
    description: "The call is urgent and needs a person now.",
    instruction: "the call is an emergency that needs immediate human attention",
  },
  {
    key: "high_value",
    label: "High-value enquiry",
    description: "A large job or a significant sales opportunity.",
    instruction: "the caller describes a large or high-value job that a person should handle",
  },
  {
    key: "low_confidence",
    label: "You are unsure",
    description: "The AI cannot answer confidently.",
    instruction: "you do not know the answer and it is not in the business information you were given",
  },
  {
    key: "department",
    label: "A specific department is asked for",
    description: "The caller asks for a named team.",
    instruction: "the caller asks for a specific department or team by name",
  },
];

export function parseTriggers(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export function triggerInstructions(keys: string[]): string[] {
  return TRANSFER_TRIGGERS.filter((t) => keys.includes(t.key)).map((t) => t.instruction);
}
