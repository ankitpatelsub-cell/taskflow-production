# Publishing Tick with a Custom Domain

Total cost: ~$10/year for the domain. Hosting is free to start (Vercel free tier +
Railway $5/mo trial credit). Total time: about 30 minutes.

Architecture:

```
yourdomain.com / app.yourdomain.com  →  Vercel   (frontend, static React SPA)
api.yourdomain.com                   →  Railway  (backend Node.js + WebSocket + PostgreSQL)
```

---

## Step 1 — Buy a domain (~5 min)

Any registrar works. Recommended:

- **Cloudflare Registrar** (https://domains.cloudflare.com) — at-cost pricing (~$10/yr for .com), free DNS
- **Namecheap** (https://namecheap.com) — frequent first-year deals

Search for the name you want (e.g. `tickapp.com`, `usetick.io`, `getticked.app`) and buy it.
You do NOT need any hosting add-ons — just the bare domain.

---

## Step 2 — Deploy the backend to Railway (~10 min)

1. Go to https://railway.app and sign in with your GitHub account.
2. **New Project → Deploy from GitHub repo** → pick `taskflow-production`.
   Railway reads `railway.toml` from the repo root automatically.
3. In the same project: **+ New → Database → PostgreSQL**. Railway injects
   `DATABASE_URL` into your service automatically — verify it appears under
   the service's **Variables** tab.
4. Add the remaining variables (Variables tab). Minimum required:

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | run `openssl rand -hex 32` locally and paste |
   | `JWT_REFRESH_SECRET` | another `openssl rand -hex 32` |
   | `CORS_ORIGIN` | `https://app.yourdomain.com` (set to your real domain) |
   | `ANTHROPIC_API_KEY` | optional — enables AI features |
   | `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | optional — enables email verification/invites |

   See `.env.production.example` for the full list (Stripe, Sentry, OAuth, Slack).
5. Open the service → **Settings → Networking → Custom Domain** → add
   `api.yourdomain.com`. Railway shows you a CNAME target (e.g.
   `xxxx.up.railway.app`) — keep this tab open for Step 4.
6. Wait for the first deploy to go green, then check
   `https://<railway-generated-url>/api/health` returns `{"status":"ok"}`.
   Migrations run automatically on boot, and a default admin is created —
   **copy the admin password from the deploy logs** (printed once at startup).

---

## Step 3 — Deploy the frontend to Vercel (~5 min)

1. Go to https://vercel.com and sign in with GitHub.
2. **Add New → Project** → import `taskflow-production`.
3. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite (auto-detected)
4. Add Environment Variables (Production):

   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | `https://api.yourdomain.com/api` |
   | `VITE_WS_URL`  | `wss://api.yourdomain.com/ws` |

5. **Deploy.** You'll get a working `*.vercel.app` URL immediately.
6. **Settings → Domains** → add `app.yourdomain.com` (and optionally the bare
   `yourdomain.com`). Vercel shows the DNS records needed — next step.

---

## Step 4 — Point your domain (DNS) (~5 min + propagation)

In your registrar's DNS panel, add:

| Type | Name | Value |
|---|---|---|
| CNAME | `app` | `cname.vercel-dns.com` |
| CNAME | `api` | the `xxxx.up.railway.app` target from Step 2.5 |
| A | `@` (bare domain, optional) | `76.76.21.21` (Vercel) |

HTTPS certificates are issued automatically by both platforms once DNS resolves
(usually < 10 minutes, can take up to an hour).

---

## Step 5 — Final wiring + smoke test

1. In Railway, confirm `CORS_ORIGIN` exactly matches your frontend origin:
   `https://app.yourdomain.com` (no trailing slash). Redeploy if you changed it.
2. Visit `https://app.yourdomain.com` → register a new account or log in with
   the admin credentials from the Railway deploy logs.
3. Verify in order:
   - Login works (if it fails with a CORS error in the browser console → fix `CORS_ORIGIN`)
   - Create a project → tasks board loads
   - Open a task and add a comment → real-time updates confirm the WebSocket
     (`VITE_WS_URL`) is connected
   - Analytics page renders

---

## Costs & scaling

| Service | Free tier | Paid starts at |
|---|---|---|
| Vercel | 100 GB bandwidth/mo — plenty | $20/mo (not needed early) |
| Railway | $5 one-time trial credit | ~$5–10/mo for API + Postgres |
| Domain | — | ~$10/yr |

When Railway's trial credit runs out the backend sleeps; add a card on the
Hobby plan ($5/mo) to keep it always-on.

## Alternative: single-server deploy

If you prefer everything on one $6/mo VPS (Hetzner/DigitalOcean), the repo's
`docker-compose.yml` runs the full stack (Postgres + backend + Caddy-served
frontend with automatic Let's Encrypt HTTPS) with one command:

```bash
git clone <repo-url> && cd taskflow-production
cp .env.production.example .env   # fill in DOMAIN, JWT secrets, DB_PASSWORD, etc.
docker compose up -d --build
```

Point the domain's A record at the VPS IP before starting — Caddy provisions
the TLS cert automatically on first boot. Vercel + Railway above is the
easier and faster route if you'd rather not manage a server.
