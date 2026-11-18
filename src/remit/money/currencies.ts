/**
 * Currency metadata used for money arithmetic and formatting.
 *
 * `minorUnits` is the ISO-4217 exponent: the number of decimal places the
 * currency has. Every amount in this module is stored and passed around as an
 * integer count of those minor units.
 */
export type CurrencyCode = string;

export interface CurrencyMeta {
  code: CurrencyCode;
  name: string;
  symbol: string;
  minorUnits: number;
}

const CURRENCIES: Record<string, CurrencyMeta> = {
  EUR: { code: "EUR", name: "Euro", symbol: "€", minorUnits: 2 },
  ZAR: { code: "ZAR", name: "South African Rand", symbol: "R", minorUnits: 2 },
  GBP: { code: "GBP", name: "Pound Sterling", symbol: "£", minorUnits: 2 },
  USD: { code: "USD", name: "US Dollar", symbol: "$", minorUnits: 2 },
  NGN: { code: "NGN", name: "Nigerian Naira", symbol: "₦", minorUnits: 2 },
  GHS: { code: "GHS", name: "Ghanaian Cedi", symbol: "₵", minorUnits: 2 },
  KES: { code: "KES", name: "Kenyan Shilling", symbol: "KSh", minorUnits: 2 },
};

export function getCurrency(code: CurrencyCode): CurrencyMeta {
  const meta = CURRENCIES[code.toUpperCase()];
  if (!meta) {
    throw new Error(`Unknown currency: ${code}. Add it to src/remit/money/currencies.ts`);
  }
  return meta;
}

export function isKnownCurrency(code: string): boolean {
  return Boolean(CURRENCIES[code?.toUpperCase()]);
}

export function listCurrencies(): CurrencyMeta[] {
  return Object.values(CURRENCIES);
}
