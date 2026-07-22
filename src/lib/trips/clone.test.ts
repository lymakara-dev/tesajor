import { describe, expect, it } from "vitest";
import { cloneTripStructure, dayOffsetBetween, shiftByDays } from "./clone";

describe("dayOffsetBetween", () => {
  it("computes a positive offset when shifting forward", () => {
    expect(dayOffsetBetween(new Date("2026-01-01"), new Date("2026-01-08"))).toBe(7);
  });

  it("computes a negative offset when shifting backward", () => {
    expect(dayOffsetBetween(new Date("2026-01-10"), new Date("2026-01-01"))).toBe(-9);
  });

  it("is zero for the same date", () => {
    expect(dayOffsetBetween(new Date("2026-01-01"), new Date("2026-01-01"))).toBe(0);
  });

  it("ignores time-of-day", () => {
    expect(
      dayOffsetBetween(new Date("2026-01-01T23:00:00"), new Date("2026-01-02T01:00:00")),
    ).toBe(1);
  });
});

describe("shiftByDays", () => {
  it("shifts a date forward, preserving time-of-day", () => {
    const result = shiftByDays(new Date("2026-01-01T09:30:00"), 5);
    expect(result.getDate()).toBe(6);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(30);
  });

  it("handles month rollover correctly", () => {
    const result = shiftByDays(new Date("2026-01-30T00:00:00"), 3);
    expect(result.getMonth()).toBe(1); // February (0-indexed)
    expect(result.getDate()).toBe(2);
  });
});

describe("cloneTripStructure", () => {
  const baseItem = {
    dayNumber: 1,
    sortOrder: 0,
    title: "Museum visit",
    category: "sight",
    plannedStart: new Date("2026-01-01T09:00:00"),
    plannedEnd: new Date("2026-01-01T11:00:00"),
    plannedCostCents: 1500,
    currency: "USD",
    placeName: "Some Museum",
    placeId: "place123",
    lat: 40.0,
    lng: -70.0,
    address: "123 Main St",
  };

  it("shifts item dates by the same offset as the trip start date", () => {
    const result = cloneTripStructure({
      originalStartDate: new Date("2026-01-01"),
      originalEndDate: new Date("2026-01-03"),
      newStartDate: new Date("2026-02-01"),
      items: [baseItem],
    });

    expect(result.newEndDate.toISOString().slice(0, 10)).toBe("2026-02-03");
    expect(result.items[0].plannedStart?.toISOString().slice(0, 10)).toBe("2026-02-01");
    expect(result.items[0].plannedStart?.getHours()).toBe(9);
    expect(result.items[0].plannedEnd?.toISOString().slice(0, 10)).toBe("2026-02-01");
  });

  it("keeps day_number, category, and place info unchanged", () => {
    const result = cloneTripStructure({
      originalStartDate: new Date("2026-01-01"),
      originalEndDate: new Date("2026-01-03"),
      newStartDate: new Date("2026-06-15"),
      items: [baseItem],
    });

    const cloned = result.items[0];
    expect(cloned.dayNumber).toBe(baseItem.dayNumber);
    expect(cloned.category).toBe(baseItem.category);
    expect(cloned.placeId).toBe(baseItem.placeId);
    expect(cloned.lat).toBe(baseItem.lat);
    expect(cloned.plannedCostCents).toBe(baseItem.plannedCostCents);
  });

  it("leaves null planned dates as null", () => {
    const result = cloneTripStructure({
      originalStartDate: new Date("2026-01-01"),
      originalEndDate: new Date("2026-01-03"),
      newStartDate: new Date("2026-06-15"),
      items: [{ ...baseItem, plannedStart: null, plannedEnd: null }],
    });
    expect(result.items[0].plannedStart).toBeNull();
    expect(result.items[0].plannedEnd).toBeNull();
  });

  it("does not include any journal/notes data (caller never copies item_notes)", () => {
    const result = cloneTripStructure({
      originalStartDate: new Date("2026-01-01"),
      originalEndDate: new Date("2026-01-03"),
      newStartDate: new Date("2026-06-15"),
      items: [baseItem],
    });
    expect(result.items[0]).not.toHaveProperty("notes");
    expect(result.items[0]).not.toHaveProperty("noteText");
  });
});
