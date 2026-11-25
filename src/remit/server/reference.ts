import crypto from "crypto";
import { brand } from "../config/brand";

/**
 * Customer-facing transfer reference, e.g. `KS-7QK4-2M9X`.
 *
 * Crockford-style alphabet: no I, L, O, U or 0/1, so a reference read over the
 * phone to support cannot be transcribed wrong. Random rather than sequential,
 * so the reference leaks nothing about volume.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateTransferReference(prefix = brand.referencePrefix): string {
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
    if (i === 3) out += "-";
  }
  return `${prefix}-${out}`;
}
