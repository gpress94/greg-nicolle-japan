// clock.js — the trip's own clock.
//
// The app reads "now" as the device's local time. Family at home are in a
// different time zone from Greg & Nicolle, so here "now" is the local time
// wherever the two of them are, whatever the viewer's device says.
//
// TRIP.clock (inside the encrypted itinerary) lists each departure and arrival
// as { at: '<UTC instant>Z', local: '<local wall time there>' }. Between two
// points the clock runs evenly from one to the next, so on the ground it keeps
// that place's time, and in the air it moves from the departure's local time
// to the arrival's. Before the first point and after the last it keeps the
// nearest point's offset.
//
// The result is a Date whose device-local fields (getHours(), the calendar
// date) show that local time, which is what the rest of the app reads. Without
// usable points it is the device's own clock, as before.

function toPoint(p) {
  const at = Date.parse(p?.at);
  const wall = Date.parse(`${p?.local}Z`); // the local wall time, read as if it were UTC
  return Number.isFinite(at) && Number.isFinite(wall) ? { at, wall } : null;
}

/**
 * The trip's local wall time at `instant`, as a Date whose device-local fields
 * show it, or null when there are no usable clock points.
 * @param {Array<{at:string, local:string}>} points
 * @param {number} instant milliseconds since the epoch
 * @returns {Date|null}
 */
export function tripLocalTime(points, instant) {
  const pts = (Array.isArray(points) ? points : []).map(toPoint).filter(Boolean).sort((a, b) => a.at - b.at);
  if (!pts.length || !Number.isFinite(instant)) return null;
  const first = pts[0];
  const last = pts[pts.length - 1];
  let wall;
  if (instant <= first.at) wall = instant + (first.wall - first.at);
  else if (instant >= last.at) wall = instant + (last.wall - last.at);
  else {
    const i = pts.findIndex((p) => p.at > instant);
    const a = pts[i - 1];
    const b = pts[i];
    wall = a.wall + ((instant - a.at) * (b.wall - a.wall)) / (b.at - a.at);
  }
  const w = new Date(Math.round(wall));
  return new Date(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate(),
    w.getUTCHours(), w.getUTCMinutes(), w.getUTCSeconds(), w.getUTCMilliseconds());
}

/**
 * A "now" provider for the app's clock seam: the trip's local time, falling
 * back to the device clock.
 * @param {Array<{at:string, local:string}>} points
 * @returns {() => Date}
 */
export function tripClock(points) {
  return () => tripLocalTime(points, Date.now()) ?? new Date();
}
