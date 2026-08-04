import { describe, expect, it } from "vitest";
import { provinceByCode, provinceForPoint } from "./provinces";
import { PROVINCES } from "./provinces-data";

describe("provinceForPoint", () => {
  it("maps central Phnom Penh to KH-12", () => {
    const p = provinceForPoint(11.5564, 104.9282);
    expect(p?.code).toBe("KH-12");
    expect(p?.nameEn).toBe("Phnom Penh");
    expect(p?.nameKm).toBe("ភ្នំពេញ");
  });

  it("maps Siem Reap town to KH-17", () => {
    const p = provinceForPoint(13.3671, 103.8448);
    expect(p?.code).toBe("KH-17");
    expect(p?.nameEn).toBe("Siem Reap");
  });

  it("maps Kampot town to KH-7", () => {
    const p = provinceForPoint(10.5947, 104.164);
    expect(p?.code).toBe("KH-7");
    expect(p?.nameEn).toBe("Kampot");
  });

  it("maps Battambang town to KH-2", () => {
    const p = provinceForPoint(13.0957, 103.2022);
    expect(p?.code).toBe("KH-2");
    expect(p?.nameEn).toBe("Battambang");
  });

  it("maps Kep town to KH-23 (small province, not swallowed by Kampot)", () => {
    expect(provinceForPoint(10.4829, 104.3167)?.code).toBe("KH-23");
  });

  it("maps Sihanoukville to KH-18 (multi-polygon province with islands)", () => {
    expect(provinceForPoint(10.6268, 103.5115)?.code).toBe("KH-18");
  });

  it("returns null for a point in the open sea (Gulf of Thailand)", () => {
    expect(provinceForPoint(9.5, 102.5)).toBeNull();
  });

  it("returns null for Bangkok, Thailand", () => {
    expect(provinceForPoint(13.7563, 100.5018)).toBeNull();
  });

  it("returns null for Ho Chi Minh City, Vietnam", () => {
    expect(provinceForPoint(10.8231, 106.6297)).toBeNull();
  });

  it("returns null far outside the region", () => {
    expect(provinceForPoint(0, 0)).toBeNull();
    expect(provinceForPoint(48.8566, 2.3522)).toBeNull();
  });

  it("bundles exactly 25 provinces with both names present", () => {
    expect(PROVINCES).toHaveLength(25);
    for (const p of PROVINCES) {
      expect(p.code).toMatch(/^KH-\d+$/);
      expect(p.nameEn.length).toBeGreaterThan(0);
      expect(p.nameKm.length).toBeGreaterThan(0);
      expect(p.polygons.length).toBeGreaterThan(0);
    }
  });
});

describe("provinceByCode", () => {
  it("finds a province by ISO code", () => {
    expect(provinceByCode("KH-17")?.nameEn).toBe("Siem Reap");
  });

  it("returns null for unknown codes", () => {
    expect(provinceByCode("KH-99")).toBeNull();
  });
});
