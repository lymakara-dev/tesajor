import { describe, expect, it } from "vitest";
import { centsToAmountInput, convertAmountString, convertCents } from "./convert";

const RATE = 4100;

describe("convertCents", () => {
  it("is a no-op when currencies match", () => {
    expect(convertCents(1050, "USD", "USD", RATE)).toBe(1050);
    expect(convertCents(410000, "KHR", "KHR", RATE)).toBe(410000);
  });

  it("converts USD cents to KHR cents ($10.00 at 4100 riel/USD -> ៛41,000)", () => {
    // 1000 USD-cents = $10.00; expected riel = 10 * 4100 = 41,000, stored
    // as riel*100 (the same *100 convention cents.ts uses for KHR).
    expect(convertCents(1000, "USD", "KHR", RATE)).toBe(4_100_000);
  });

  it("converts KHR cents back to USD cents", () => {
    expect(convertCents(4_100_000, "KHR", "USD", RATE)).toBe(1000);
  });

  it("round-trips without drift when the rate divides evenly", () => {
    const original = 2500; // $25.00
    const toKhr = convertCents(original, "USD", "KHR", RATE);
    const backToUsd = convertCents(toKhr, "KHR", "USD", RATE);
    expect(backToUsd).toBe(original);
  });

  it("rounds to the nearest integer cent when the conversion doesn't divide evenly", () => {
    // 333 KHR-cents / 4100 = 0.0812... USD-cents -> rounds to 0.
    expect(convertCents(333, "KHR", "USD", RATE)).toBe(0);
    // 1 USD-cent * 4100 = 4100 KHR-cents exactly.
    expect(convertCents(1, "USD", "KHR", RATE)).toBe(4100);
  });

  it("throws for an unsupported currency pair", () => {
    // @ts-expect-error -- exercising the runtime guard with an invalid currency
    expect(() => convertCents(100, "USD", "EUR", RATE)).toThrow();
  });
});

describe("centsToAmountInput", () => {
  it("formats USD with two decimals", () => {
    expect(centsToAmountInput(1050, "USD")).toBe("10.50");
  });

  it("formats KHR as a whole number with no decimals", () => {
    expect(centsToAmountInput(4_100_000, "KHR")).toBe("41000");
  });

  it("rounds a fractional riel amount to the nearest whole riel", () => {
    expect(centsToAmountInput(4_100_050, "KHR")).toBe("41001"); // 41000.5 -> rounds up
  });
});

describe("convertAmountString", () => {
  it("converts a USD input string to the equivalent KHR string", () => {
    expect(convertAmountString("10.00", "USD", "KHR", RATE)).toBe("41000");
  });

  it("converts a KHR input string to the equivalent USD string", () => {
    expect(convertAmountString("41000", "KHR", "USD", RATE)).toBe("10.00");
  });

  it("is a no-op string-wise when currencies match (still normalizes formatting)", () => {
    expect(convertAmountString("10", "USD", "USD", RATE)).toBe("10.00");
    expect(convertAmountString("41000.00", "KHR", "KHR", RATE)).toBe("41000");
  });

  it("returns null for empty input", () => {
    expect(convertAmountString("", "USD", "KHR", RATE)).toBeNull();
  });

  it("returns null for invalid (non-numeric) input", () => {
    expect(convertAmountString("abc", "USD", "KHR", RATE)).toBeNull();
  });

  it("returns null for negative input", () => {
    expect(convertAmountString("-5", "USD", "KHR", RATE)).toBeNull();
  });
});
