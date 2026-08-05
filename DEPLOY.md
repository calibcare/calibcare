# Deploying CalibCare (Railway + Netlify)

This checklist covers moving off local-dev-only (ngrok + Vite proxy) to a
permanent deployment: backend + MySQL on Railway, frontend on Netlify, on
separate permanent domains.

Account creation and the actual deploy/click-through steps in Railway's and
Netlify's dashboards need to be done by you directly (they require your own
identity/billing) — this doc is the reference for exactly what to enter.

---

## 1. Railway — backend + MySQL

### 1a. Add a MySQL plugin to the Railway project
1. In the Railway project, click **+ New** → **Database** → **Add MySQL**.
2. Railway provisions a MySQL instance and exposes its connection details as
   variables on that plugin (`MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`,
   `MYSQLPASSWORD`, `MYSQLDATABASE`) — use these values to fill in the
   backend service's own `DB_*` variables below (Railway does not
   auto-inject them into a *different* service under the `DB_*` names this
   app expects).
3. **Load the schema and seed data into the new database** — it starts
   empty. From your machine, pointed at the Railway MySQL's public
   connection details:
   ```
   mysql -h <MYSQLHOST> -P <MYSQLPORT> -u <MYSQLUSER> -p<MYSQLPASSWORD> <MYSQLDATABASE> < database/schema.sql
   mysql -h <MYSQLHOST> -P <MYSQLPORT> -u <MYSQLUSER> -p<MYSQLPASSWORD> <MYSQLDATABASE> < database/seed_data.sql
   mysql -h <MYSQLHOST> -P <MYSQLPORT> -u <MYSQLUSER> -p<MYSQLPASSWORD> <MYSQLDATABASE> < database/enrich_category_manufacturer.sql
   ```
   (`schema.sql` drops and recreates all 5 tables first — safe to run once
   against the fresh empty database, but don't re-run it later against a
   database with real production data in it.)

### 1b. Backend service — root directory
Point the Railway service at the `backend/` folder (its build/start commands
assume that as the working directory — `npm start` runs `node src/server.js`).

### 1c. Environment variables to set on the backend service
| Variable | Value |
|---|---|
| `PORT` | **Don't set this** — Railway provides it automatically at runtime, and the app already reads `process.env.PORT`. |
| `DB_HOST` | from the MySQL plugin's `MYSQLHOST` |
| `DB_PORT` | from the MySQL plugin's `MYSQLPORT` (not 3306) |
| `DB_USER` | from the MySQL plugin's `MYSQLUSER` |
| `DB_PASSWORD` | from the MySQL plugin's `MYSQLPASSWORD` |
| `DB_NAME` | from the MySQL plugin's `MYSQLDATABASE` |
| `JWT_SECRET` | a long random string (generate a new one for production — don't reuse the local dev value) |
| `JWT_EXPIRES_IN` | e.g. `30d` |
| `FRONTEND_URL` | the Netlify site's URL, e.g. `https://calibcare.netlify.app` (set this *after* the Netlify site exists — see below) |
| `LINE_CHANNEL_ACCESS_TOKEN` | from the LINE Developers Console |
| `LINE_CHANNEL_SECRET` | from the LINE Developers Console |
| `LINE_OA_BASIC_ID` | e.g. `@456cagya` (optional — powers the "add as friend" link) |

Full reference list with comments: `backend/.env.example`.

### 1d. Create a Railway Cron Job service for the daily reminder check
The old in-process `node-cron` scheduler is gone — `scripts/checkNotifications.js`
now runs once and exits, meant to be invoked on a schedule by Railway itself:

1. In the same Railway project, click **+ New** → **Empty Service** (or
   duplicate the backend service and repoint it) and set it to run:
   ```
   node scripts/checkNotifications.js
   ```
   (root directory `backend/`, same as the main service.)
2. Under that service's **Settings → Cron Schedule**, set a cron expression,
   e.g. `0 9 * * *` (daily at 9am, in whatever timezone Railway's cron
   runs in — check Railway's docs for its timezone, it's UTC by default).
3. Give this service the **same environment variables** as the backend
   service (`DB_*`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`) — it
   needs its own database and LINE credentials, it does not share the main
   service's runtime.

### 1e. Update the LINE webhook URL
Once the backend has a stable Railway URL, update the webhook URL in the
LINE Developers Console (Messaging API tab) from the old ngrok URL to:
```
https://<your-backend>.up.railway.app/api/line/webhook
```

---

## 2. Netlify — frontend

### 2a. Site settings
- **Base directory**: `frontend`
- **Build command**: `npm run build`
- **Publish directory**: `frontend/dist` (or just `dist` if the base
  directory is already set to `frontend`)

### 2b. Environment variable to set on the Netlify site
| Variable | Value |
|---|---|
| `VITE_API_URL` | the Railway backend's URL, e.g. `https://calibcare-backend.up.railway.app` |

Reference: `frontend/.env.example`.

### 2c. After the Netlify site is live
Go back to Railway and set the backend's `FRONTEND_URL` variable to this
Netlify URL (step 1c above) — until that's set, CORS defaults to allowing
any origin, which works but isn't the intended locked-down production
config.

---

## 3. Post-deploy verification checklist

- [ ] `GET https://<backend>/health` returns `{"status":"ok"}`
- [ ] The Netlify site loads and shows the CalibCare login page
- [ ] Register a new account → succeeds, returns a token
- [ ] Log in with that account → succeeds, lands on the dashboard
- [ ] Dashboard, Equipment, Decision Support pages all load real data (confirms `VITE_API_URL` → Railway → MySQL is wired correctly end-to-end)
- [ ] A request from a browser on a *different* origin than the Netlify URL is blocked by CORS (confirms `FRONTEND_URL` is actually restricting access, not just present)
- [ ] Manually trigger the Cron Job service once from the Railway dashboard ("Run now" / redeploy) and confirm its logs show `[checkNotifications] evaluated N item(s)` with no fatal error
- [ ] If any equipment is genuinely due/overdue at deploy time, confirm a real LINE message arrives for a linked account

Note: this checklist does not include an OTP-over-email step — domain-restricted
registration and email-based 2FA are not implemented yet (tracked as a
separate future task, not part of this deployment prep).
