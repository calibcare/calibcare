# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Working agreement for this project

- Before starting work, read `project_status.md` — it's the running log of what has been built and decided.
- After finishing any unit of work in this folder (a file created, a schema change, data loaded, a feature implemented), update `project_status.md` with what changed and what's next, before ending the turn.
- Keep `project_status.md` terse and current — it exists so a session can be closed and reopened without losing context, not as a full history.

## What this is

CalibCare (originally "MCEMS") is a web app for medical-equipment calibration companies: a centralized equipment database, an automatic LINE-based calibration reminder system, a monitoring dashboard, and a Decision Support System (DSS) that recommends suitable calibration equipment for a given set of measurement requirements. See `README.md` for the full spec/objectives and `project_status.md` for what's actually been built, verified, and decided so far — the latter is more current and should be trusted over the README where they diverge.

## Commands

**Backend** (`backend/`, Node/Express, ESM):
- `npm install`
- `npm run dev` — `node --watch src/server.js`, port 3001
- `npm start` — `node src/server.js` (no watch)
- `npm test` — runs all `test/*.test.js` via the built-in `node --test` runner
- `node --test test/dssMatcher.test.js` — run a single test file
- Requires a local MySQL server and a `backend/.env` (see `backend/.env.example`) with `DB_*`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `LINE_CHANNEL_ACCESS_TOKEN`/`LINE_CHANNEL_SECRET`/`LINE_OA_BASIC_ID`, `REMINDER_CRON`.

**Frontend** (`frontend/`, React + Vite):
- `npm install`
- `npm run dev` — Vite dev server, port 5173
- `npm run build` — production build
- `npm run lint` — `oxlint`
- `npm run preview` — preview a production build
- `frontend/.env` sets `VITE_API_BASE_URL` (see "Frontend ↔ backend wiring" below for why it's usually left empty).

**Database** (MySQL, database name `mcems`):
- Reload from scratch: `mysql -u root < database/schema.sql && mysql -u root < database/seed_data.sql` (`schema.sql` drops and recreates all 5 tables first).
- `seed_data.sql` is generated from the source Excel register (`00 FP-ENG-05-01 ...xlsx`) via `python3 database/generate_seed_data.py` — don't hand-edit the seed file, regenerate it.
- `database/enrich_category_manufacturer.sql` is a one-time, already-applied enrichment pass (adds `category`/`manufacturer` values not present in the source Excel) — re-run only if reloading the DB from scratch and you want that data back.

## Architecture

Three tiers: MySQL (`mcems`, 5 tables) ← Express backend (`backend/src`) ← React frontend (`frontend/src`).

**Backend is routes → services**: `src/routes/*.js` are thin HTTP handlers; real logic lives in `src/services/*.js`. All routes except `/api/auth/*` and `/api/line/webhook` require `requireAuth` (JWT), and equipment/capability writes additionally require `requireCapability('canEdit')` — see `src/middleware/auth.js` and the mounting order in `src/server.js`.

**Access levels**: `users.role` holds an engineering *position* (`deputy_manager` / `senior_specialist` / `specialist_1_pm` / `specialist_1` / `specialist_2`), ranked by seniority. `services/positions.js` is the single definition of that hierarchy and what each level can do — nothing else should hardcode a position list. Deputy Manager and Senior Specialist have `canEdit`; only Deputy Manager has `canRunReminders` (which also gates assigning positions). Everyone can read everything and use the DSS. `requireAuth` deliberately loads the position from the database rather than the JWT claim, so a position change takes effect immediately despite 30-day tokens. Registration never accepts a position from the request body — new accounts start at `specialist_2`.

**Schema**: `equipment` (one row per instrument) → `equipment_capability` (measurement purposes an instrument supports — this is what the DSS matches against) and `calibration_history` (append-only events). `users` holds the position + `line_user_id`; `notification_log` is the reminder audit trail (used for dedup, see below). Calibration dates live on `equipment`, not per-capability — confirmed from source data that capabilities under one instrument share a calibration date. `equipment.status` is a normalized ENUM with the original free-text Thai status preserved in `status_note`. Serial numbers are not unique (a plain index) — real duplicates exist in the source data.

**DSS matching** (`services/dssMatcher.js` + `services/rangeParser.js`): requirements are checked against `equipment_capability.measurement_range`, not `product_operating_range` — confirmed against real data, see `project_status.md` for the reasoning. `rangeParser.js` has a key heuristic: a hyphen directly between two digits is a range separator, not a minus sign (real negative values in this dataset are written as `"-0.8 to 10 bar"`). Unit mismatches (e.g. `l/min` vs `slpm`) are explicit failures, not silently-wrong comparisons. Results are ranked by tightest-fitting range first.

**Reminders**: `services/reminderService.js` exports `pickBucket(daysUntilDue)` — the single definition of overdue/due/7/14/30-day buckets, reused by `services/dashboardService.js` so the dashboard and the reminder scheduler can't drift apart. `scheduler.js` runs it daily via `node-cron` (`REMINDER_CRON`); `POST /api/reminders/run` (Deputy Manager only) triggers it manually. Before sending, it checks `notification_log` for an existing `(calibration_id, bucket)` row to avoid re-notifying — dry-run sends (no `LINE_CHANNEL_ACCESS_TOKEN` configured) are deliberately never logged there, or a real send would get permanently blocked once a real token is added.

**LINE integration**: `services/linkCodeStore.js` holds short-lived, single-use, in-memory (not DB) 6-digit codes linking a logged-in user to a LINE account. `POST /api/line/link-code` (authenticated) issues one; the user sends it to the LINE OA as a chat message; `POST /api/line/webhook` (public, HMAC-signature-verified via `services/lineWebhookService.js`) matches it and writes `users.line_user_id`. The webhook route needs the *raw* request body for signature verification, so `server.js` configures `express.json({ verify })` to stash it on `req.rawBody` before parsing. `services/lineClient.js` returns a dry-run client (logs instead of calling LINE) whenever `LINE_CHANNEL_ACCESS_TOKEN` is unset.

**`db.js` gotcha**: the mysql2 pool is configured with `dateStrings: true`. Do not remove this — without it, `DATE` columns come back as JS `Date` objects that `res.json()` serializes via UTC `.toISOString()`, which silently shifts every date shown in the app by one day on a server east of UTC (this happened once; see `project_status.md`'s "Date display bug" entry for the full story).

**Frontend ↔ backend wiring**: `api/client.js`'s axios `baseURL` reads `import.meta.env.VITE_API_BASE_URL ?? ''` — note the `??`, not `||` (an empty string must stay empty, not fall back to a hardcoded host). `vite.config.js` proxies `/api` to `http://localhost:3001` and sets `server.host: true` / `server.allowedHosts: true`. This means the frontend works identically whether it's opened via `localhost`, a LAN IP, or a public tunnel (e.g. ngrok) — API calls are always relative and get proxied internally, so there's no separate public endpoint to configure for the backend. `AuthContext` stores `{token, user}` in `localStorage`; `ProtectedRoute` gates every route except `/login`; role-based UI (e.g. hiding edit buttons) reads the `can_edit`/`can_run_reminders` flags the API returns on the user object, and is a UX nicety only — `requireCapability` on the backend is the actual enforcement.

**Local environment specifics** (not portable assumptions, just how this dev setup happens to be configured): MySQL running locally with no root password — **the real `mcems` data lives in the Homebrew MySQL install** (`/opt/homebrew/bin/mysql`, datadir `/opt/homebrew/var/mysql`, registered as an auto-starting `brew services` login item), **not** the separate Oracle-installer MySQL that's also present on this Mac (`/usr/local/mysql`, its own empty datadir, launchd service now deliberately disabled — see `project_status.md`'s "Local MySQL environment mixup" entry for why two installs exist and how this was diagnosed); a demo account `admin@mcems.local` / `correct-horse-battery-staple` exists in the dev DB; a persistent ngrok tunnel is sometimes used to expose the dev servers publicly — see `project_status.md` for the current public URL and its caveats.
