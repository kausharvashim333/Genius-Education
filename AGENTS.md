# Project verification

- This is an Express application with plain HTML/JavaScript portals. The web server runs with `npm start` on port 3001; there is no separate web bundling step. Electron packaging uses the existing `build:mac` / `build:win` scripts.
- Run `npm test` for isolated lead assignment and faculty session tests. Fixtures use in-memory data and stub email delivery; tests do not load `.env`, start the full application, or modify `data/`.
- Run `npm run test:browser` on macOS/Linux for the optional Puppeteer workflow test. It requires the existing Puppeteer dependency and its installed Chrome browser. External network requests are blocked in this test.
- Syntax checks: `node --check server.js`, `node --check public/js/admin.js`, and `node --check public/js/faculty-portal.js`. Also run `git diff --check`.
- The full server reads and writes real JSON files in `data/` and has external integrations. Prefer the isolated test harness for verification instead of starting the full server against live project data.
- Staff accounts are stored in `faculty.json`. Lead access is based on `assignedToId`, not the display name in `assignedTo`. Legacy name-only assignments must be explicitly linked by an admin; do not infer access from matching names.
