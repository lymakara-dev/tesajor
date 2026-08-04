import { describe, expect, it } from "vitest";
import {
  azureSsml,
  azureTtsUrl,
  getTtsConfig,
  googleTtsBody,
  parseGoogleAudio,
} from "./tts";

describe("getTtsConfig", () => {
  it("returns null when unset (silent mode)", () => {
    expect(getTtsConfig({})).toBeNull();
    expect(getTtsConfig({ TTS_PROVIDER: "azure" })).toBeNull();
    expect(getTtsConfig({ TTS_API_KEY: "k" })).toBeNull();
  });

  it("rejects unknown providers", () => {
    expect(getTtsConfig({ TTS_PROVIDER: "espeak", TTS_API_KEY: "k" })).toBeNull();
  });

  it("requires a region for azure but not google", () => {
    expect(getTtsConfig({ TTS_PROVIDER: "azure", TTS_API_KEY: "k" })).toBeNull();
    expect(
      getTtsConfig({ TTS_PROVIDER: "azure", TTS_API_KEY: "k", TTS_REGION: "southeastasia" }),
    ).toEqual({ provider: "azure", apiKey: "k", region: "southeastasia" });
    expect(getTtsConfig({ TTS_PROVIDER: "google", TTS_API_KEY: "k" })).toEqual({
      provider: "google",
      apiKey: "k",
      region: null,
    });
  });
});

describe("azure driver builders", () => {
  it("builds the regional endpoint URL", () => {
    expect(azureTtsUrl("southeastasia")).toBe(
      "https://southeastasia.tts.speech.microsoft.com/cognitiveservices/v1",
    );
  });

  it("wraps the phrase in SSML with the Khmer neural voice", () => {
    expect(azureSsml("សូមស្វាគមន៍មកកាន់ កំពត", "km")).toBe(
      '<speak version="1.0" xml:lang="km-KH"><voice name="km-KH-SreymomNeural">សូមស្វាគមន៍មកកាន់ កំពត</voice></speak>',
    );
  });

  it("escapes XML in place names", () => {
    expect(azureSsml("Welcome to Tom & Jerry's <Café>", "en")).toContain(
      "Welcome to Tom &amp; Jerry&apos;s &lt;Café&gt;",
    );
  });
});

describe("google driver builders", () => {
  it("builds the synthesize request body", () => {
    expect(googleTtsBody("១៥ នាទីទៀត ទៅ កែប", "km")).toEqual({
      input: { text: "១៥ នាទីទៀត ទៅ កែប" },
      voice: { languageCode: "km-KH" },
      audioConfig: { audioEncoding: "MP3" },
    });
  });

  it("decodes base64 audioContent", () => {
    const bytes = parseGoogleAudio({ audioContent: Buffer.from("mp3!").toString("base64") });
    expect(bytes.toString()).toBe("mp3!");
  });

  it("throws when the response has no audio", () => {
    expect(() => parseGoogleAudio({})).toThrow("No audio in response");
    expect(() => parseGoogleAudio(undefined)).toThrow("No audio in response");
  });
});
