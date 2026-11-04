# Japan, together · family site

A read-only view of Greg & Nicolle's honeymoon, for family and friends. It's
adapted from Jacob's trip site and published with GitHub Pages. Everything on it sits behind
a shared password, which Greg gives out; it isn't stored anywhere in this repo.
The dates and places only appear after the password, so the public page and
repo don't say when the house is empty.

## How it fits with the planner

The shared ChatGPT planner (`../japan-planner`) is where the Japan part of the
trip is planned, booked and changed. Those days are a copy of its Today view
with the private parts taken out.

- **Left out:**
  - booking references and confirmation numbers
  - ticket, booking-manager and Gmail links
  - the planner's full notes
  - allergy details and the to-do lists
- **Encrypted:** the itinerary itself, in `data/days.enc.json`. `unlock.js`
  decrypts it in the browser once someone enters the password, in any
  capitalization. The page is also marked `noindex`.

## The rest of the trip

The planner only covers Japan. The days after it are written by hand in
`private/trip-extras.json`, which git ignores; only the encrypted copy is
published. Keep places and dates out of this README and the code: the repo is
public.

- The file lives only on Greg's Mac. If it's ever lost, the build's readable
  copy (`.local/days.plain.json`) or a decrypted `data/days.enc.json` has the
  same days.
- Edit it like the planner's days: `date`, `base`, `title`, `intro`,
  `dayParts`, `photos`, `lodging` and a `plan` of stops.
  - A stop's `time` is a clock time ("17:55"), or "Morning", "Midday",
    "Afternoon", "Evening" or "Night" when there's no set time. A stop without
    a time stays with the one before it.
  - Transit `mode` can be plane, train, bus, subway or boat.
- Never put booking references in it. The build stops if any text there looks
  like one (letters and digits mixed, or five or more digits).
- If the planner ever covers one of these dates itself, take that day out of
  the file; the build stops on a clash.

## Times and "now"

Times on the site are local to wherever Greg & Nicolle are, and so is "now":
family at home see the same Today and Now/Next as the two of them.
`clock.js` does this from `trip.clock` in the private file, which lists each
flight's departure and arrival as a UTC instant and a local time. In the air,
the clock runs evenly from the departure's local time to the arrival's.

## Updating it after the plan changes

1. Get the latest plan, either way:
   - In the planner: **Documents → Export itinerary as JSON**.
   - Or save a signed-in `GET /api/plan` response.
2. Rebuild:
   ```sh
   FAMILY_PASSWORD='…' node --experimental-strip-types tools/build-family.mjs path/to/plan.json
   ```
   - This rewrites `data/days.enc.json` and the service-worker version in `sw.js`.
   - It uses the planner checkout at `../japan-planner` by default; pass `--planner <dir>` for another.
   - It merges in `private/trip-extras.json` and stops if that file is missing
     (`--japan-only` builds without it).
   - It stops without writing anything if a booking reference from the plan would still appear.
3. Commit and push to `main`. GitHub publishes it within a couple of minutes.
   Anyone who already has the site open gets the new version on their next
   visit: the page reloads itself once the new version has downloaded.

The readable copy the build makes goes to `.local/`, which git ignores. Never
commit a plan export, the private file or the password.

## Preview

```sh
python3 -m http.server 8050 --bind 127.0.0.1   # then open http://localhost:8050
```

Bind to 127.0.0.1 so the private file and the readable copy aren't reachable
from the local network. Add `?now=YYYY-MM-DDTHH:MM` (local time at the trip) to
the address to see a moment in the trip, and `?now=clear` to go back to the
real clock. On localhost the service worker is skipped, but the browser can
still cache `app.js`; hard-reload after changing it.
