#!/usr/bin/env node
// Builds the family site's encrypted itinerary, data/days.enc.json, from the
// shared trip planner. The words come from the planner's own Today view, so the
// two always match.
//
//   FAMILY_PASSWORD=… node --experimental-strip-types tools/build-family.mjs <plan.json> [--planner ../japan-planner]
//
// <plan.json> is the planner's Documents → "Export itinerary as JSON", or a
// saved GET /api/plan response. --planner points at a planner checkout; it
// defaults to ../japan-planner, the code that is live.
//
// Nothing private is committed or published:
// - The password comes from FAMILY_PASSWORD, never from this repo.
// - The planner's full notes, document and ticket links, and allergy lines are
//   left out. Notes the planner fills in from its own long notes are dropped
//   too; only the Today view's written words are kept.
// - The build stops if any reference found in the plan's documents or
//   reservation records would still appear in the output.
// - The readable copy goes to .local/, which is ignored by git.

import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';

registerHooks({ resolve(s, c, n) { try { return n(s, c); } catch (e) { if (s.startsWith('.') && !s.endsWith('.ts')) return n(s + '.ts', c); throw e; } } });

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = args.indexOf('--planner');
const plannerDir = resolve(flag >= 0 ? args[flag + 1] : resolve(ROOT, '../japan-planner'));
const planFile = args.find((a, i) => !a.startsWith('--') && i !== flag + 1);
const password = String(process.env.FAMILY_PASSWORD ?? '').trim().toLowerCase();
if (!planFile || !password) {
  console.error('Usage: FAMILY_PASSWORD=… node --experimental-strip-types tools/build-family.mjs <plan.json> [--planner <dir>]');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(planFile, 'utf8'));
const plan = raw.plan ?? raw;
const { buildToday, firstSentence } = await import(pathToFileURL(resolve(plannerDir, 'app/today-model.ts')).href);
const today = buildToday(plan);

// Ticket pages, booking managers and Gmail links work like the bookings themselves.
const PRIVATE_URL = /mail\.google|\/mytickets\/|\/reservations?\/|tblc\.hk|bokun\.io/i;
const publicUrl = (u) => (typeof u === 'string' && /^https:\/\//.test(u) && !PRIVATE_URL.test(u) ? u : undefined);
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));

function stopFor(date, id) {
  return plan.days.find((d) => d.date === date)?.stops.find((s) => s.id === id);
}

// Today falls back to the first sentence of the planner's note when it has no
// words of its own. Those sentences can carry references, so they are dropped.
function writtenNote(item, stop) {
  if (!item.note) return undefined;
  return stop && item.note === firstSentence(stop.note) ? undefined : item.note;
}

function toItem(item, date) {
  const stop = stopFor(date, item.id);
  return clean({
    time: item.time,
    until: item.until,
    tag: item.tag,
    title: item.title,
    note: writtenNote(item, stop),
    website: publicUrl(item.website),
    mapUrl: publicUrl(item.directions),
    coords: stop && Number.isFinite(stop.lat) && Number.isFinite(stop.lng) ? { lat: stop.lat, lng: stop.lng } : undefined,
    reserved: item.status === 'booked' || undefined,
    status: item.status,
    optional: item.optional || undefined,
    getThere: item.getThere,
    transit: item.ride ? clean({ mode: item.ride.mode, line: item.ride.line, from: item.ride.from, to: item.ride.to, minutes: item.ride.minutes }) : undefined,
    ready: item.ready,
    leaveBy: item.leaveBy,
  });
}

function toLodging(lodging, date) {
  if (!lodging) return undefined;
  const hotel = plan.days.find((d) => d.date === date)?.stops.find((s) => s.kind === 'hotel' && s.name === lodging.name);
  return clean({
    name: lodging.name,
    address: lodging.address,
    mapUrl: publicUrl(lodging.directions),
    coords: hotel ? { lat: hotel.lat, lng: hotel.lng } : undefined,
    breakfast: lodging.breakfast,
  });
}

const DAYS = today.days.map((d) => clean({
  date: d.date,
  base: d.base,
  title: d.title,
  intro: d.intro,
  photos: d.photos.map(({ url, alt, credit }) => ({ url, alt, credit })),
  lodging: toLodging(d.lodging, d.date),
  dayParts: d.dayParts,
  plan: d.items.map((item) => toItem(item, d.date)),
}));
const TRIP = { title: today.title, start: today.start, end: today.end, travelers: ['Greg', 'Nicolle'], eveningWindow: { startHour: 21, endHour: 4 } };
const output = JSON.stringify({ TRIP, DAYS });

// References live in the plan's documents and reservation records; none may survive.
const PUBLIC_CODE = /^(?:SQ|JL|BA|NH|Q2)\d{1,4}$/;
function referencesIn(p) {
  const text = [
    ...(p.documents ?? []).flatMap((d) => [d.name, d.note, d.url]),
    ...(p.companion?.reservations ?? []).flatMap((r) => [r.stop?.note, r.cancellation, r.source]),
  ].filter(Boolean).join(' ');
  const found = new Set();
  for (const [t] of text.matchAll(/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/g)) {
    // Flight numbers and phrases such as "90-minute" are not references.
    if (PUBLIC_CODE.test(t) || /^\d+-[a-z]+$/i.test(t) || /^[a-z]+-\d+$/i.test(t)) continue;
    if ((t.length >= 5 && /\d/.test(t) && /[A-Za-z]/.test(t)) || /^\d{5,}$/.test(t)) found.add(t);
  }
  // Letter-only codes, such as a six-letter booking code, follow words like "reference".
  for (const [, t] of text.matchAll(/\b(?:reference|ref|code|PNR|booking|confirmation|reservation)\s*[#:]?\s*([A-Za-z0-9]{5,8})\b/gi)) {
    if (/^[A-Z0-9]+$/.test(t)) found.add(t);
  }
  return found;
}
const leaks = [...referencesIn(plan)].filter((t) => new RegExp(`(^|[^A-Za-z0-9])${t.replace(/[-]/g, '\\-')}([^A-Za-z0-9]|$)`).test(output));
if (leaks.length) {
  console.error(`Stopped: ${leaks.length} reference(s) from the plan would be published. Nothing was written.`);
  for (const t of leaks) console.error(`  ${t}: ${output.slice(Math.max(0, output.indexOf(t) - 80), output.indexOf(t) + t.length + 40)}`);
  process.exit(2);
}

// AES-GCM with a PBKDF2 key from the lower-cased password, matching unlock.js.
const crypto = webcrypto;
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const iterations = 250000;
const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(output)));
const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const box = JSON.stringify({ v: 1, iterations, salt: b64(salt), iv: b64(iv), data: b64(sealed) });
writeFileSync(resolve(ROOT, 'data/days.enc.json'), box + '\n');

// Installed phones pick up a new itinerary or shell when the service worker's version changes.
const shell = ['index.html', 'app.js', 'unlock.js', 'data/days.js', 'manifest.json'].map((f) => readFileSync(resolve(ROOT, f), 'utf8')).join('\n');
const stamp = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(box + shell))).toString('hex').slice(0, 10);
const swPath = resolve(ROOT, 'sw.js');
writeFileSync(swPath, readFileSync(swPath, 'utf8').replace(/const CACHE_VERSION = '[^']*';/, `const CACHE_VERSION = 'family-${stamp}';`));

mkdirSync(resolve(ROOT, '.local'), { recursive: true });
writeFileSync(resolve(ROOT, '.local/days.plain.json'), JSON.stringify({ TRIP, DAYS }, null, 1) + '\n');
console.log(`Wrote data/days.enc.json: ${DAYS.length} days, ${DAYS.reduce((n, d) => n + d.plan.length, 0)} stops. Cache version family-${stamp}.`);
