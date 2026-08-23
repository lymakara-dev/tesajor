import { describe, expect, it } from "vitest";
import { generateInviteCode } from "./id";

describe("generateInviteCode", () => {
  it("generates a 10-character string by default", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(10);
    expect(typeof code).toBe("string");
  });

  it("generates strings of custom specified length", () => {
    expect(generateInviteCode(5)).toHaveLength(5);
    expect(generateInviteCode(16)).toHaveLength(16);
    expect(generateInviteCode(32)).toHaveLength(32);
  });

  it("contains only URL-safe characters (alphanumeric, -, _)", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode(20);
      expect(code).toMatch(/^[0-9A-Za-z_-]+$/);
    }
  });

  it("generates unique values across multiple invocations", () => {
    const set = new Set<string>();
    const count = 1000;
    for (let i = 0; i < count; i++) {
      set.add(generateInviteCode(10));
    }
    expect(set.size).toBe(count);
  });
});
