import { describe, expect, it } from "vitest";
import { buildPhrase, phraseHash } from "./phrases";

describe("buildPhrase", () => {
  it("assembles the Khmer welcome from the message-file template", () => {
    expect(buildPhrase("welcome", "km", "អង្គរវត្ត")).toBe("សូមស្វាគមន៍មកកាន់ អង្គរវត្ត");
  });

  it("assembles the English welcome", () => {
    expect(buildPhrase("welcome", "en", "Angkor Wat")).toBe("Welcome to Angkor Wat");
  });

  it("assembles the Khmer reminder", () => {
    expect(buildPhrase("reminder", "km", "ផ្សារចាស់")).toBe("១៥ នាទីទៀត ទៅ ផ្សារចាស់");
  });

  it("trims whitespace around the place name", () => {
    expect(buildPhrase("welcome", "en", "  Kampot Market  ")).toBe("Welcome to Kampot Market");
  });
});

describe("phraseHash", () => {
  it("is stable for the same text and differs for different text", () => {
    const a = phraseHash("សូមស្វាគមន៍មកកាន់ អង្គរវត្ត");
    expect(a).toBe(phraseHash("សូមស្វាគមន៍មកកាន់ អង្គរវត្ត"));
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(phraseHash("Welcome to Angkor Wat"));
  });
});
