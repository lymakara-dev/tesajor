import { describe, expect, it } from "vitest";
import {
  ARRIVAL_DWELL_MS,
  ARRIVAL_RADIUS_METERS,
  INITIAL_ARRIVAL_STATE,
  updateArrival,
  type ArrivalState,
} from "./arrival";

const at = (stopId: string, distanceMeters: number, nowMs: number) => ({
  stopId,
  distanceMeters,
  nowMs,
});

describe("updateArrival", () => {
  it("fires after dwelling inside the radius for the debounce window", () => {
    let state: ArrivalState = INITIAL_ARRIVAL_STATE;
    let fired: boolean;

    ({ state, fired } = updateArrival(state, at("stop-1", 50, 0)));
    expect(fired).toBe(false);

    ({ state, fired } = updateArrival(state, at("stop-1", 40, 5_000)));
    expect(fired).toBe(false);

    ({ state, fired } = updateArrival(state, at("stop-1", 30, ARRIVAL_DWELL_MS)));
    expect(fired).toBe(true);
    expect(state.firedStopIds).toEqual(["stop-1"]);
  });

  it("never fires twice for the same stop", () => {
    let state: ArrivalState = INITIAL_ARRIVAL_STATE;
    ({ state } = updateArrival(state, at("stop-1", 50, 0)));
    ({ state } = updateArrival(state, at("stop-1", 50, ARRIVAL_DWELL_MS)));
    expect(state.firedStopIds).toEqual(["stop-1"]);

    let fired: boolean;
    ({ state, fired } = updateArrival(state, at("stop-1", 10, 60_000)));
    expect(fired).toBe(false);
    ({ state, fired } = updateArrival(state, at("stop-1", 10, 120_000)));
    expect(fired).toBe(false);
  });

  it("resets the dwell when the traveler leaves the radius (GPS jitter)", () => {
    let state: ArrivalState = INITIAL_ARRIVAL_STATE;
    ({ state } = updateArrival(state, at("stop-1", 80, 0)));
    // Bounced out at 8s...
    ({ state } = updateArrival(state, at("stop-1", ARRIVAL_RADIUS_METERS + 50, 8_000)));
    // ...back in at 9s: the 10s clock restarts, so 12s must NOT fire.
    let fired: boolean;
    ({ state, fired } = updateArrival(state, at("stop-1", 60, 9_000)));
    expect(fired).toBe(false);
    ({ state, fired } = updateArrival(state, at("stop-1", 60, 12_000)));
    expect(fired).toBe(false);
    ({ state, fired } = updateArrival(state, at("stop-1", 60, 19_000)));
    expect(fired).toBe(true);
  });

  it("restarts the dwell when the next stop changes mid-dwell", () => {
    let state: ArrivalState = INITIAL_ARRIVAL_STATE;
    ({ state } = updateArrival(state, at("stop-1", 50, 0)));
    ({ state } = updateArrival(state, at("stop-2", 50, 6_000)));
    let fired: boolean;
    ({ state, fired } = updateArrival(state, at("stop-2", 50, 11_000)));
    expect(fired).toBe(false); // only 5s at stop-2
    ({ state, fired } = updateArrival(state, at("stop-2", 50, 16_000)));
    expect(fired).toBe(true);
  });

  it("uses the 100 m / 10 s defaults", () => {
    expect(ARRIVAL_RADIUS_METERS).toBe(100);
    expect(ARRIVAL_DWELL_MS).toBe(10_000);
  });
});
