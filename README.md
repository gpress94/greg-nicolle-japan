# Japan, together · family site

A read-only view of Greg & Nicolle's honeymoon in Japan, for family and
friends. It's adapted from Jacob's trip site and published with GitHub Pages.
Everything on it sits behind a shared password, which Greg gives out; it isn't
stored anywhere in this repo. The dates and places only appear after the
password, so the public page and repo don't say when the house is empty.

## How it fits with the planner

The shared ChatGPT planner (`../japan-planner`) is where the trip is planned,
booked and changed. This site is a copy of its Today view with the private
parts taken out.

- **Left out:**
  - booking references and confirmation numbers
  - ticket, booking-manager and Gmail links
  - the planner's full notes
  - allergy details and the to-do lists
- **Encrypted:** the itinerary itself, in `data/days.enc.json`. `unlock.js`
  decrypts it in the browser once someone enters the password, in any
  capitalization. The page is also marked `noindex`.

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
   - It stops without writing anything if a booking reference from the plan would still appear.
3. Commit and push to `main`. GitHub publishes it within a couple of minutes.

The readable copy the build makes goes to `.local/`, which git ignores. Never
commit a plan export or the password.

## Preview

```sh
python3 -m http.server 8050   # then open http://localhost:8050
```

Add `?now=YYYY-MM-DDTHH:MM` to the address to see a moment in the trip. On
localhost the service worker is skipped, so the preview is never a stale copy.
