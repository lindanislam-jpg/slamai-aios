import { describe, expect, it } from "vitest";
import { Money } from "@/remit/money/money";

describe("Money", () => {
  it("parses decimal strings into exact minor units", () => {
    expect(Money.fromDecimalString("300", "EUR").minor).toBe(30_000n);
    expect(Money.fromDecimalString("300.55", "EUR").minor).toBe(30_055n);
    expect(Money.fromDecimalString("0.01", "EUR").minor).toBe(1n);
  });

  it("rejects more decimal places than the currency has", () => {
    expect(() => Money.fromDecimalString("300.555", "EUR")).toThrow(/2 decimal place/);
  });

  it("rejects non-numeric input rather than coercing it", () => {
    expect(() => Money.fromDecimalString("3e2", "EUR")).toThrow();
    expect(() => Money.fromDecimalString("", "EUR")).toThrow();
    expect(() => Money.fromDecimalString("300,55", "EUR")).toThrow();
  });

  it("adds without floating-point drift", () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point. It must here.
    const total = Money.fromDecimalString("0.1", "EUR").add(Money.fromDecimalString("0.2", "EUR"));
    expect(total.toDecimalString()).toBe("0.30");
  });

  it("stays exact across a thousand additions", () => {
    let total = Money.zero("EUR");
    for (let i = 0; i < 1000; i += 1) {
      total = total.add(Money.fromDecimalString("0.07", "EUR"));
    }
    expect(total.toDecimalString()).toBe("70.00");
  });

  it("refuses to mix currencies", () => {
    expect(() => Money.fromDecimalString("1", "EUR").add(Money.fromDecimalString("1", "ZAR"))).toThrow(
      /Cannot combine EUR with ZAR/,
    );
  });

  it("converts at a rate and rounds down to the destination minor unit", () => {
    // 300.00 EUR * 19.85 = 5955.00 ZAR exactly.
    const converted = Money.fromDecimalString("300", "EUR").convert("19.85", "ZAR");
    expect(converted.currency).toBe("ZAR");
    expect(converted.toDecimalString()).toBe("5955.00");
  });

  it("rounds a fractional conversion down, never up", () => {
    // 10.00 EUR * 19.857777 = 198.57777 ZAR -> 198.57, not 198.58. We never
    // quote a cent of FX we did not buy.
    const converted = Money.fromDecimalString("10", "EUR").convert("19.857777", "ZAR");
    expect(converted.toDecimalString()).toBe("198.57");
  });

  it("rejects a non-integer minor amount", () => {
    expect(() => Money.fromMinor(10.5, "EUR")).toThrow(/integer/);
  });

  it("serialises amounts as strings so no client can float them", () => {
    const dto = Money.fromDecimalString("305", "EUR").toJSON();
    expect(dto).toMatchObject({ currency: "EUR", minor: "30500", amount: "305.00" });
    expect(typeof dto.minor).toBe("string");
    expect(JSON.parse(JSON.stringify(dto)).minor).toBe("30500");
  });

  it("handles amounts far beyond the 32-bit range", () => {
    const large = Money.fromDecimalString("999999999999", "EUR");
    expect(large.add(Money.fromDecimalString("0.01", "EUR")).toDecimalString()).toBe(
      "999999999999.01",
    );
  });

  it("compares amounts correctly", () => {
    const ten = Money.fromDecimalString("10", "EUR");
    const twenty = Money.fromDecimalString("20", "EUR");
    expect(ten.lessThan(twenty)).toBe(true);
    expect(twenty.greaterThan(ten)).toBe(true);
    expect(ten.equals(Money.fromMinor(1000n, "EUR"))).toBe(true);
  });
});
