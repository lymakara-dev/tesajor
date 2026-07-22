import { describe, expect, it } from "vitest";
import { canCompleteItems, canEditTrip, canJournal, canManageTrip } from "./permissions";

describe("trip permissions", () => {
  it("owner can do everything", () => {
    expect(canEditTrip("owner")).toBe(true);
    expect(canCompleteItems("owner")).toBe(true);
    expect(canJournal("owner")).toBe(true);
    expect(canManageTrip("owner")).toBe(true);
  });

  it("editor can edit/complete/journal but not manage the trip", () => {
    expect(canEditTrip("editor")).toBe(true);
    expect(canCompleteItems("editor")).toBe(true);
    expect(canJournal("editor")).toBe(true);
    expect(canManageTrip("editor")).toBe(false);
  });

  it("viewer can only journal", () => {
    expect(canEditTrip("viewer")).toBe(false);
    expect(canCompleteItems("viewer")).toBe(false);
    expect(canJournal("viewer")).toBe(true);
    expect(canManageTrip("viewer")).toBe(false);
  });

  it("no role (non-member) can do nothing", () => {
    expect(canEditTrip(undefined)).toBe(false);
    expect(canCompleteItems(undefined)).toBe(false);
    expect(canJournal(undefined)).toBe(false);
    expect(canManageTrip(undefined)).toBe(false);
  });
});
