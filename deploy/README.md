# Deploying ДомойСкорей to a single host (5.42.108.44)

Self-hosted Docker Compose stack: Caddy (TLS + static + reverse proxy) → API → Postgres + MinIO.
Everything except Caddy stays on a private network; only **80/443** (and SSH) are open.

```
                 Internet
                    │ 80/443
              ┌─────▼─────┐    https://<domain>            ┌──────────┐
              │   caddy   │──/api,/health──────────────────▶│   api    │
              │  (TLS,    │──/, /admin (static SPA bundles) │ :3001    │
              │  ACME)    │                                 └────┬─────┘
              │           │   https://cdn.<domain>               │  │
              └─────┬─────┘──────────────▶ minio :9000           │  │
                    │                          ▲                 │  │
   private network  │                          └─────────────────┘  │ (S3)
                    │                                    db :5432 ◀──┘
```

## What's exposed

| Port      | Service           | Reachable from                           |
| --------- | ----------------- | ---------------------------------------- |
| 22        | SSH               | internet (ufw `limit` + fail2ban)        |
| 80        | Caddy             | internet (ACME + redirect → 443)         |
| 443       | Caddy             | internet                                 |
| 5432      | Postgres          | **private network only** (not published) |
| 9000/9001 | MinIO API/console | **private network only**                 |
| 3001      | API               | **private network only**                 |

`/internal/*` (incl. the destructive `db-reset`) is **not** proxied by Caddy, so it is unreachable from outside — it can only be hit from inside the `api` container.

---

## Prerequisites

1. **A domain.** Create two A records pointing at the host _before_ you start (Caddy needs them to issue certs):
   - `A  <domain>      → 5.42.108.44`
   - `A  cdn.<domain>  → 5.42.108.44`
2. **Yandex OAuth app** at https://oauth.yandex.ru/ with redirect URI **exactly**:
   `https://<domain>/api/auth/yandex/callback` (scopes: `login:email login:info login:avatar`)
3. **Yandex Maps key** at https://developer.tech.yandex.ru/, referrer-restricted to `https://<domain>/*`.
4. SSH key-based access to the host as a sudo user.

---

## Step-by-step

### 1. Harden the server

```bash
scp deploy/harden.sh root@5.42.108.44:/root/
ssh root@5.42.108.44 'bash /root/harden.sh'
```

Installs Docker + compose, sets ufw (deny-in, allow 22/80/443), fail2ban (SSH jail), and unattended security upgrades. Then do the manual SSH hardening it prints (disable password auth) once key login is confirmed.

### 2. Get the code onto the host

```bash
ssh root@5.42.108.44
git clone https://github.com/C0rWin/petreutine.git
cd petreutine/deploy
```

### 3. Configure secrets

```bash
cp .env.example .env
# generate strong secrets:
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "ADMIN_API_KEY=$(openssl rand -hex 32)"
nano .env   # set DOMAIN, ACME_EMAIL, passwords, Yandex creds, maps key
```

### 4. Bring it up

```bash
docker compose --env-file .env up -d --build
```

Boot order is enforced by healthchecks: `db` → `minio` → `minio-init` (creates bucket, sets public-download) → `api` (runs `AUTO_MIGRATE` to create the schema) → `caddy` (fetches TLS certs on first request). First boot takes a few minutes for the image builds + cert issuance.

### 5. Validate

```bash
./validate.sh
```

Checks container health, DB connectivity + schema bootstrap, MinIO bucket, all public TLS endpoints, that `/internal` is _not_ exposed, and that OAuth init redirects to Yandex. Then manually open `https://<domain>`, log in with Yandex, and confirm you return logged-in (the **first** user to log in is auto-granted admin → use `/admin`).

---

## Database

- **Persistence:** Postgres data lives in the named volume `pgdata`; it survives `docker compose down` and restarts. It is deleted only by `docker compose down -v` or `docker volume rm`.
- **Bootstrap:** `api` runs `initializeDatabase()` on startup (`AUTO_MIGRATE=true`), applying `server/src/db/schema.sql` (idempotent). Performance indexes in `server/src/db/migrations/003_performance_indexes.sql` are **not** auto-applied — run once if you want them:
  ```bash
  docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    < ../server/src/db/migrations/003_performance_indexes.sql
  ```
- **Backups:**
  ```bash
  docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backup-$(date +%F).sql.gz
  ```
- **Hardening the DB link (optional, defence-in-depth):** the stack uses `DATABASE_SSL=disable` for the api↔db hop because it runs over the private Docker bridge (never published). To require TLS instead: configure Postgres with a server cert, mount the CA into the api container, drop `DATABASE_SSL`, and set `DATABASE_CA_CERT` to the CA PEM — the app then enforces `rejectUnauthorized: true`.

---

## Logs

```bash
docker compose logs -f api          # application logs (JSON request log in prod)
docker compose logs -f caddy        # TLS / proxy / access
docker compose logs --since=1h db   # postgres
```

Container logs are JSON-file with rotation (10 MB × 5). Caddy also writes a rolling JSON access log inside the `caddy_logs` volume (`/var/log/caddy/access.log`).

---

## Status dashboard (Gatus)

Live health + uptime + response times for the app, every backing service, and the
external Yandex dependencies. Served behind HTTP basic auth at **https://status.{DOMAIN}**.

What it monitors (`deploy/gatus/config.yaml`):

- **Application** — public `/health`, frontend, admin panel, public API, OAuth-init redirect, TLS-cert-expiry warning.
- **Services** — API (internal `/health`), PostgreSQL (TCP), MinIO (`/minio/health/live`), CDN.
- **External dependencies** — Yandex OAuth, Yandex Login (userinfo), Yandex Maps API.

History persists in sqlite on the `gatus_data` volume. Scope: this covers service
**liveness / uptime / latency**, not host CPU/RAM/disk (add netdata or glances for those).

Setup (one-time):

1. **DNS:** add `A status.{DOMAIN} → 5.42.108.44` (same as `cdn`).
2. **Basic-auth credential** — generate a bcrypt hash and put user + hash in `.env`:
   ```bash
   docker run --rm caddy:2-alpine caddy hash-password --plaintext 'YOUR_PASSWORD'
   # paste into .env: STATUS_USER=admin / STATUS_HASH=<hash>
   ```
3. **Apply:** `docker compose --env-file .env up -d --build caddy && docker compose --env-file .env up -d gatus`
   (Caddy rebuilds because the Caddyfile is baked into its image; `gatus` is a new service.)

To add alerting later (Slack/Telegram/email on downtime), add an `alerting:` block to
`gatus/config.yaml` and `alerts:` under each endpoint — see https://github.com/TwiN/gatus.

---

## Yandex authentication — the thing most likely to break

The OAuth flow only works when **three values agree** and the host is HTTPS:

| Where                         | Must be                                             |
| ----------------------------- | --------------------------------------------------- |
| Yandex console → Redirect URI | `https://<domain>/api/auth/yandex/callback`         |
| `.env` (→ api env)            | `YANDEX_REDIRECT_URI` is derived as the same value  |
| `.env`                        | `FRONTEND_URL` / `CORS_ORIGIN` = `https://<domain>` |

Common failure modes and what you'll see:

- **`redirect_uri mismatch` / `invalid_client`** → the console URI doesn't byte-for-byte match (trailing slash, http vs https, www). Fix the console value.
- **Bare IP won't work.** Yandex does not accept `http://5.42.108.44/...` as a redirect URI, and the JWT is delivered over the redirect — that's why a real domain + TLS is required. (This is the issue you anticipated.)
- **Lands back with `?error=token_error`** → wrong `YANDEX_CLIENT_SECRET`.
- **`?error=invalid_state`** → `oauth_states` table missing (schema didn't bootstrap) or clock skew; check `docker compose logs api`.
- **Login works but maps are blank** → `VITE_YANDEX_MAPS_API_KEY` missing at build time or referrer restriction doesn't include `https://<domain>`. The maps key is baked at build, so changing it means `docker compose up -d --build caddy`.

Validate the redirect handshake without a browser:

```bash
curl -sI "https://<domain>/api/auth/yandex" | grep -i location   # should point to oauth.yandex.ru
```

---

## Updating after a code change

```bash
git pull
docker compose --env-file .env up -d --build
```

Frontend/maps-key changes require rebuilding `caddy` (the bundle is baked in); the `--build` handles it.

## Teardown

```bash
docker compose down            # keep data
docker compose down -v         # DESTROY db + minio volumes
```

---

## Known gaps carried over from the app review (not deployment blockers, worth fixing)

- JWT is delivered in the callback URL and stored in `localStorage` (XSS exposure). Prefer an HttpOnly cookie.
- First user to authenticate is auto-granted admin — log in yourself first, immediately.
- Tailwind is still loaded from the public CDN in `index.html` (no SRI, no purge).
- In-memory role cache is per-process; fine at `instance_count: 1` (this deploy), revisit before scaling out.
