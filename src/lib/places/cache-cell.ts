/**
 * Grid cell keys for the `place_cache` table.
 *
 * A geohash-style key without the dependency: lat/lng are snapped to a
 * ~0.02° grid (~2.2 km at the equator — matches the ~2 km Overpass search
 * radius), so every position inside a cell shares one cached Overpass
 * response per category.
 */

export const CELL_SIZE_DEGREES = 0.02;

/** Cache-cell key for a position, e.g. "578:5246". */
export function cacheCellForPoint(
  lat: number,
  lng: number,
  cellSizeDegrees: number = CELL_SIZE_DEGREES,
): string {
  const latIndex = Math.floor(lat / cellSizeDegrees);
  const lngIndex = Math.floor(lng / cellSizeDegrees);
  return `${latIndex}:${lngIndex}`;
}

/** Center of a cell — the coordinates Overpass is actually queried around. */
export function cellCenter(
  cell: string,
  cellSizeDegrees: number = CELL_SIZE_DEGREES,
): { lat: number; lng: number } | null {
  const match = /^(-?\d+):(-?\d+)$/.exec(cell);
  if (!match) return null;
  return {
    lat: (Number(match[1]) + 0.5) * cellSizeDegrees,
    lng: (Number(match[2]) + 0.5) * cellSizeDegrees,
  };
}
