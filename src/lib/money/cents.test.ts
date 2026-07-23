import { describe, expect, it } from "vitest";
import {
  centsToDollarsInput,
  dollarsToCents,
  formatCents,
  formatMoney,
  sumCents,
} from "./cents";
import { isSupportedCurrency } from "./currency";

describe("sumCents", () => {
  it("sums a list of integer amounts", () => {
    expect(sumCents([100, 200, 300])).toBe(600);
  });

  it("returns 0 for an empty list", () => {
    expect(sumCents([])).toBe(0);
  });
});

describe("dollarsToCents", () => {
  it("parses a plain decimal dollar amount", () => {
    expect(dollarsToCents("10.50")).toBe(1050);
  });

  it("parses a whole-number amount", () => {
    expect(dollarsToCents("10")).toBe(1000);
  });

  it("rounds sub-cent input to the nearest cent", () => {
    expect(dollarsToCents("10.005")).toBe(1001);
  });

  it("rejects an empty string", () => {
    expect(dollarsToCents("")).toBeNull();
  });

  it("rejects a whitespace-only string", () => {
    expect(dollarsToCents("   ")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(dollarsToCents("abc")).toBeNull();
  });

  it("rejects negative amounts", () => {
    expect(dollarsToCents("-5")).toBeNull();
  });

  it("accepts zero", () => {
    expect(dollarsToCents("0")).toBe(0);
  });
});

describe("centsToDollarsInput", () => {
  it("formats cents as a two-decimal dollar string", () => {
    expect(centsToDollarsInput(1050)).toBe("10.50");
  });

  it("round-trips through dollarsToCents", () => {
    expect(dollarsToCents(centsToDollarsInput(333))).toBe(333);
  });
});

describe("formatCents", () => {
  it("formats USD with two decimal places", () => {
    expect(formatCents(1050, "USD")).toBe("$10.50");
  });

  it("formats KHR with no decimals, rounded to the nearest 100 riel", () => {
    // Scenario: shares split 2:1:1 on ៛10,100 stored as 1,010,000 (riel * 100).
    expect(formatCents(1_010_000, "KHR")).toBe("KHR 10,100");
  });

  it("rounds a non-multiple-of-100 riel amount down/up to the nearest 100", () => {
    // 10,125 riel -> nearest 100 is 10,100.
    expect(formatCents(1_012_500, "KHR")).toBe("KHR 10,100");
    // 10,150 riel -> nearest 100 is 10,200 (round-half-up via Math.round).
    expect(formatCents(1_015_000, "KHR")).toBe("KHR 10,200");
  });
});

describe("formatMoney", () => {
  it("shows no secondary line for a KHR amount", () => {
    const { secondary } = formatMoney(1_010_000, "KHR");
    expect(secondary).toBeNull();
  });

  it("shows a rounded KHR secondary line for a USD amount", () => {
    const { primary, secondary } = formatMoney(1000, "USD");
    expect(primary).toBe("$10.00");
    // $10.00 * 4100 = 41,000 riel, already a multiple of 100.
    expect(secondary).toBe("៛41,000");
  });

  it("shows no secondary line for currencies with no configured conversion", () => {
    const { secondary } = formatMoney(1000, "EUR");
    expect(secondary).toBeNull();
  });
});

describe("isSupportedCurrency", () => {
  it("accepts USD and KHR", () => {
    expect(isSupportedCurrency("USD")).toBe(true);
    expect(isSupportedCurrency("KHR")).toBe(true);
  });

  it("rejects an unsupported code", () => {
    expect(isSupportedCurrency("EUR")).toBe(false);
  });
});
