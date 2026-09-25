/**
 * Passage plan for the simulated voyage and the plane-sailing maths to follow it.
 * Distances are in nautical miles, bearings in degrees true.
 */

export interface Waypoint {
  name: string;
  lat: number;
  lon: number;
}

/** Rotterdam to Gothenburg along the Dutch, German and Danish coasts. */
export const NORTH_SEA_ROUTE: Waypoint[] = [
  { name: 'Rotterdam (Maas Center)', lat: 52.0, lon: 3.85 },
  { name: 'Off Texel', lat: 53.25, lon: 4.35 },
  { name: 'German Bight', lat: 54.3, lon: 6.4 },
  { name: 'Off Hanstholm', lat: 57.25, lon: 8.3 },
  { name: 'Off Skagen', lat: 57.85, lon: 10.75 },
  { name: 'Gothenburg (Vinga)', lat: 57.63, lon: 11.6 },
];

const DEG = Math.PI / 180;

export function distanceNm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (b.lat - a.lat) * 60;
  const dLon = (b.lon - a.lon) * 60 * Math.cos(((a.lat + b.lat) / 2) * DEG);
  return Math.hypot(dLat, dLon);
}

export function bearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = b.lat - a.lat;
  const dLon = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * DEG);
  return (Math.atan2(dLon, dLat) / DEG + 360) % 360;
}

/** Moves a position `nm` along `headingDeg`. */
export function travel(pos: { lat: number; lon: number }, headingDeg: number, nm: number): { lat: number; lon: number } {
  const lat = pos.lat + (nm * Math.cos(headingDeg * DEG)) / 60;
  const lon = pos.lon + (nm * Math.sin(headingDeg * DEG)) / (60 * Math.cos(((pos.lat + lat) / 2) * DEG));
  return { lat, lon };
}

/** Signed smallest difference `to - from`, in -180..180. */
export function angleDiff(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

export function routeLengthNm(route: Waypoint[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i += 1) total += distanceNm(route[i - 1], route[i]);
  return total;
}

/** Position and leg after sailing `distance` nm along the route from its first waypoint. */
export function positionAlong(route: Waypoint[], distance: number): { lat: number; lon: number; headingDeg: number; nextIndex: number } {
  let remaining = distance;
  for (let i = 1; i < route.length; i += 1) {
    const leg = distanceNm(route[i - 1], route[i]);
    const heading = bearingDeg(route[i - 1], route[i]);
    if (remaining <= leg || i === route.length - 1) {
      const pos = travel(route[i - 1], heading, Math.min(remaining, leg));
      return { ...pos, headingDeg: heading, nextIndex: i };
    }
    remaining -= leg;
  }
  const last = route[route.length - 1];
  return { lat: last.lat, lon: last.lon, headingDeg: 0, nextIndex: route.length - 1 };
}

/** Distance from a position to the end of the route via the remaining waypoints. */
export function distanceToGo(route: Waypoint[], pos: { lat: number; lon: number }, nextIndex: number): number {
  let total = distanceNm(pos, route[nextIndex]);
  for (let i = nextIndex + 1; i < route.length; i += 1) total += distanceNm(route[i - 1], route[i]);
  return total;
}
