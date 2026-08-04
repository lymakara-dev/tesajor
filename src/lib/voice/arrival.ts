/**
 * Arrival detection for the voice welcome: fire once per stop after the
 * traveler has been within the arrival radius for a debounce dwell —
 * GPS jitter must not trigger a welcome from a passing bus. Pure state
 * machine; the Follow-mode component feeds it position samples.
 */
export const ARRIVAL_RADIUS_METERS = 100;
export const ARRIVAL_DWELL_MS = 10_000;

export interface ArrivalSample {
  stopId: string;
  distanceMeters: number;
  nowMs: number;
}

export interface ArrivalState {
  /** Stop currently being dwelled at (inside the radius). */
  candidateStopId: string | null;
  enteredAtMs: number | null;
  /** Stops already welcomed this session — never fire twice. */
  firedStopIds: string[];
}

export const INITIAL_ARRIVAL_STATE: ArrivalState = {
  candidateStopId: null,
  enteredAtMs: null,
  firedStopIds: [],
};

export function updateArrival(
  state: ArrivalState,
  sample: ArrivalSample,
  radiusMeters: number = ARRIVAL_RADIUS_METERS,
  dwellMs: number = ARRIVAL_DWELL_MS,
): { state: ArrivalState; fired: boolean } {
  if (state.firedStopIds.includes(sample.stopId) || sample.distanceMeters > radiusMeters) {
    // Outside the radius (or already welcomed): any dwell in progress resets.
    if (state.candidateStopId !== null) {
      return { state: { ...state, candidateStopId: null, enteredAtMs: null }, fired: false };
    }
    return { state, fired: false };
  }

  if (state.candidateStopId !== sample.stopId) {
    // Entered the radius of a (different) stop — start dwelling.
    return {
      state: { ...state, candidateStopId: sample.stopId, enteredAtMs: sample.nowMs },
      fired: false,
    };
  }

  if (sample.nowMs - (state.enteredAtMs ?? sample.nowMs) >= dwellMs) {
    return {
      state: {
        candidateStopId: null,
        enteredAtMs: null,
        firedStopIds: [...state.firedStopIds, sample.stopId],
      },
      fired: true,
    };
  }

  return { state, fired: false };
}
