import { describe, expect, it } from "vitest";
import { cacheCellForPoint, cellCenter, CELL_SIZE_DEGREES } from "./cache-cell";

describe("cacheCellForPoint", () => {
  it("maps nearby points to the same cell", () => {
    // Two points ~100 m apart in central Phnom Penh.
    expect(cacheCellForPoint(11.5564, 104.9282)).toBe(cacheCellForPoint(11.5568, 104.9287));
  });

  it("maps far-apart points to different cells", () => {
    expect(cacheCellForPoint(11.5564, 104.9282)).not.toBe(cacheCellForPoint(13.3671, 103.8448));
  });

  it("is stable and grid-aligned", () => {
    expect(cacheCellForPoint(11.5564, 104.9282)).toBe(
      `${Math.floor(11.5564 / CELL_SIZE_DEGREES)}:${Math.floor(104.9282 / CELL_SIZE_DEGREES)}`,
    );
  });

  it("handles negative coordinates without colliding across the equator", () => {
    expect(cacheCellForPoint(0.001, 104)).not.toBe(cacheCellForPoint(-0.001, 104));
  });
});

describe("cellCenter", () => {
  it("round-trips: a point's cell center lies in the same cell", () => {
    const cell = cacheCellForPoint(11.5564, 104.9282);
    const center = cellCenter(cell);
    expect(center).not.toBeNull();
    expect(cacheCellForPoint(center!.lat, center!.lng)).toBe(cell);
  });

  it("returns null for malformed keys", () => {
    expect(cellCenter("not-a-cell")).toBeNull();
    expect(cellCenter("1:2:3")).toBeNull();
  });
});
