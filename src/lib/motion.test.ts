import { describe, expect, it } from "vitest";
import {
  MATERIAL_STANDARD_EASE,
  MATERIAL_STANDARD_EASE_CSS,
  MICRO,
  TAP_SCALE,
  HOVER_LIFT,
  FADE_UP,
  SHEET_SLIDE_UP,
} from "./motion";

describe("motion configuration", () => {
  it("exports standard Material easing curves and timings", () => {
    expect(MATERIAL_STANDARD_EASE).toEqual([0.4, 0, 0.2, 1]);
    expect(MATERIAL_STANDARD_EASE_CSS).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
    expect(MICRO.duration).toBe(0.18);
    expect(TAP_SCALE.scale).toBe(0.97);
    expect(HOVER_LIFT.scale).toBe(1.01);
  });

  it("exports valid animation presets", () => {
    expect(FADE_UP.initial.opacity).toBe(0);
    expect(FADE_UP.animate.opacity).toBe(1);
    expect(SHEET_SLIDE_UP.initial.y).toBe("100%");
    expect(SHEET_SLIDE_UP.animate.y).toBe(0);
  });
});
