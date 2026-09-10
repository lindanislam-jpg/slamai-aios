import Decimal from "decimal.js";
import { getCurrency, type CurrencyCode } from "./currencies";

/**
 * `Money` — the only representation of an amount allowed in this module.
 *
 * Amounts are held as a `bigint` count of minor units (cents), so arithmetic is
 * exact. JavaScript floating point is never used for money: `0.1 + 0.2` is not
 * `0.3`, and a remittance business cannot absorb that.
 *
 * Rates are handled with decimal.js at a fixed precision, and the conversion
 * back to minor units applies an explicit, documented rounding mode.
 */

// Plenty of headroom for rate maths without ever hitting binary floating point.
const RateDecimal = Decimal.clone({ precision: 34, toExpNeg: -30, toExpPos: 30 });

export type RateInput = string | number | Decimal | { toString(): string };

export class Money {
  readonly minor: bigint;
  readonly currency: CurrencyCode;

  private constructor(minor: bigint, currency: CurrencyCode) {
    this.minor = minor;
    this.currency = currency;
  }

  /** Build from an integer count of minor units (cents). */
  static fromMinor(minor: bigint | number | string, currency: CurrencyCode): Money {
    const code = normaliseCode(currency);
    let value: bigint;
    if (typeof minor === "bigint") {
      value = minor;
    } else if (typeof minor === "number") {
      if (!Number.isInteger(minor)) {
        throw new Error(`Minor units must be an integer, received ${minor}`);
      }
      if (!Number.isSafeInteger(minor)) {
        throw new Error(`Minor units ${minor} exceeds the safe integer range`);
      }
      value = BigInt(minor);
    } else {
      if (!/^-?\d+$/.test(minor.trim())) {
        throw new Error(`Minor units must be an integer string, received "${minor}"`);
      }
      value = BigInt(minor.trim());
    }
    return new Money(value, code);
  }

  /**
   * Build from a decimal string such as "300" or "300.55".
   *
   * Deliberately rejects anything with more decimal places than the currency
   * supports rather than silently rounding a user's input.
   */
  static fromDecimalString(amount: string, currency: CurrencyCode): Money {
    const code = normaliseCode(currency);
    const { minorUnits } = getCurrency(code);
    const trimmed = String(amount).trim();
    const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
    if (!match) {
      throw new Error(`"${amount}" is not a valid ${code} amount`);
    }
    const [, sign, whole, fraction = ""] = match;
    if (fraction.length > minorUnits) {
      throw new Error(
        `${code} supports ${minorUnits} decimal place(s); "${amount}" has ${fraction.length}`,
      );
    }
    const padded = fraction.padEnd(minorUnits, "0");
    const value = BigInt(`${whole}${padded}`);
    return new Money(sign === "-" ? -value : value, code);
  }

  static zero(currency: CurrencyCode): Money {
    return new Money(0n, normaliseCode(currency));
  }

  get minorUnits(): number {
    return getCurrency(this.currency).minorUnits;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minor + other.minor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minor - other.minor, this.currency);
  }

  /**
   * Multiply by a rate/ratio, rounding half-up to the nearest minor unit.
   * Used for percentage fees, not for FX (see `convert`).
   */
  multiply(rate: RateInput): Money {
    const product = new RateDecimal(this.minor.toString()).times(toDecimal(rate));
    return new Money(decimalToBigInt(product, Decimal.ROUND_HALF_UP), this.currency);
  }

  /**
   * Convert to another currency at `rate` (1 unit of this currency buys `rate`
   * units of the target currency).
   *
   * The result is rounded DOWN to the target currency's minor unit. Rounding
   * down means the quoted recipient amount is always deliverable by the FX we
   * actually buy — we never promise a cent we did not purchase. The
   * sub-cent remainder stays with us and is negligible, but it is a deliberate
   * choice rather than an accident of floating point.
   */
  convert(rate: RateInput, targetCurrency: CurrencyCode): Money {
    const target = normaliseCode(targetCurrency);
    const scale = getCurrency(target).minorUnits - this.minorUnits;
    const converted = new RateDecimal(this.minor.toString())
      .times(toDecimal(rate))
      .times(new RateDecimal(10).pow(scale));
    return new Money(decimalToBigInt(converted, Decimal.ROUND_DOWN), target);
  }

  isZero(): boolean {
    return this.minor === 0n;
  }

  isNegative(): boolean {
    return this.minor < 0n;
  }

  isPositive(): boolean {
    return this.minor > 0n;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.minor === other.minor;
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.minor < other.minor) return -1;
    if (this.minor > other.minor) return 1;
    return 0;
  }

  greaterThan(other: Money): boolean {
    return this.compare(other) === 1;
  }

  lessThan(other: Money): boolean {
    return this.compare(other) === -1;
  }

  /** Plain decimal string, e.g. "305.00". No currency symbol, no grouping. */
  toDecimalString(): string {
    const units = this.minorUnits;
    const negative = this.minor < 0n;
    const digits = (negative ? -this.minor : this.minor).toString().padStart(units + 1, "0");
    const whole = digits.slice(0, digits.length - units) || "0";
    const fraction = units > 0 ? `.${digits.slice(digits.length - units)}` : "";
    return `${negative ? "-" : ""}${whole}${fraction}`;
  }

  /** Localised display string, e.g. "€305.00" or "R5,932.11". */
  format(locale = "en-IE"): string {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: this.currency,
      minimumFractionDigits: this.minorUnits,
      maximumFractionDigits: this.minorUnits,
    }).format(Number(this.toDecimalString()));
  }

  /**
   * Wire format. Amounts cross the network as strings so no JSON parser can
   * round-trip them through a float.
   */
  toJSON(): MoneyDTO {
    return {
      currency: this.currency,
      minor: this.minor.toString(),
      amount: this.toDecimalString(),
      formatted: this.format(),
    };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Cannot combine ${this.currency} with ${other.currency} — convert first`,
      );
    }
  }
}

export interface MoneyDTO {
  currency: string;
  /** Integer count of minor units, as a string. The authoritative value. */
  minor: string;
  /** Human-readable decimal string, e.g. "305.00". */
  amount: string;
  /** Localised display string, e.g. "€305.00". */
  formatted: string;
}

function normaliseCode(currency: CurrencyCode): string {
  const code = String(currency).toUpperCase();
  getCurrency(code); // throws on unknown currencies
  return code;
}

function toDecimal(rate: RateInput): Decimal {
  if (rate instanceof Decimal) return new RateDecimal(rate.toString());
  return new RateDecimal(typeof rate === "number" ? String(rate) : rate.toString());
}

function decimalToBigInt(value: Decimal, rounding: Decimal.Rounding): bigint {
  return BigInt(value.toDecimalPlaces(0, rounding).toFixed(0));
}

/** Basis points -> multiplier, e.g. 50 bps -> 0.005. */
export function bpsToDecimal(bps: number): Decimal {
  return new RateDecimal(bps).dividedBy(10_000);
}

export { RateDecimal, Decimal };
