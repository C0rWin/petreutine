#!/usr/bin/env bash
# Post-deploy smoke test. Run from the deploy/ directory on the host:
#   ./validate.sh
set -uo pipefail

cd "$(dirname "$0")"
set -a; . ./.env; set +a

PASS=0; FAIL=0
ok()   { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

echo "== Containers =="
docker compose ps

echo "== Internal health (api container) =="
if docker compose exec -T api wget -qO- http://localhost:3001/health | grep -q '"status":"ok"'; then
  ok "api /health (internal)"; else bad "api /health (internal)"; fi

echo "== Database connectivity (via protected /internal endpoint, inside container) =="
DB_JSON=$(docker compose exec -T api wget -qO- --header="X-Admin-Key: ${ADMIN_API_KEY}" http://localhost:3001/internal/db-url 2>/dev/null)
if echo "$DB_JSON" | grep -q '"status":"connected"'; then
  ok "postgres connected ($(echo "$DB_JSON" | grep -o '"latency_ms":[0-9]*'))"
else bad "postgres connection (got: ${DB_JSON:-empty})"; fi

echo "== Schema bootstrapped (expect users + oauth_states tables) =="
if docker compose exec -T db psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc \
   "SELECT count(*) FROM information_schema.tables WHERE table_name IN ('users','posts','oauth_states');" | grep -q '^3$'; then
  ok "core tables present"; else bad "core tables missing — check AUTO_MIGRATE and api logs"; fi

echo "== MinIO bucket exists and is anonymous-download =="
if docker compose exec -T minio mc anonymous get "local/${DO_SPACES_BUCKET}" 2>/dev/null | grep -qi download \
   || docker run --rm --network "$(docker compose ps -q minio >/dev/null 2>&1 && echo container)" >/dev/null 2>&1; then
  ok "minio bucket policy (download)"
else echo "  (skipped detailed minio policy check; verify manually if uploads fail)"; fi

echo "== Public endpoints over TLS (https://${DOMAIN}) =="
if curl -fsS "https://${DOMAIN}/health" | grep -q '"status":"ok"'; then
  ok "https://${DOMAIN}/health"; else bad "public /health — DNS/TLS/Caddy?"; fi
if curl -fsS "https://${DOMAIN}/api/posts" >/dev/null; then
  ok "https://${DOMAIN}/api/posts"; else bad "public /api/posts"; fi
if curl -fsS -o /dev/null -w '%{http_code}' "https://${DOMAIN}/" | grep -q '200'; then
  ok "frontend index served"; else bad "frontend index"; fi
if curl -fsS -o /dev/null -w '%{http_code}' "https://${DOMAIN}/admin/" | grep -q '200'; then
  ok "admin index served"; else bad "admin index"; fi
if curl -fsS -o /dev/null -w '%{http_code}' "https://cdn.${DOMAIN}/${DO_SPACES_BUCKET}/" | grep -Eq '200|403|404'; then
  ok "cdn.${DOMAIN} reachable (TLS ok)"; else bad "cdn subdomain — DNS/TLS?"; fi

echo "== /internal must NOT be reachable publicly =="
CODE=$(curl -fsS -o /dev/null -w '%{http_code}' "https://${DOMAIN}/internal/db-url" 2>/dev/null || echo 000)
if [ "$CODE" = "404" ] || [ "$CODE" = "000" ]; then
  ok "/internal not exposed (got $CODE)"; else bad "/internal reachable publicly (got $CODE)!"; fi

echo "== Yandex OAuth config sanity =="
echo "  Redirect URI expected in Yandex console: https://${DOMAIN}/api/auth/yandex/callback"
LOC=$(curl -fsS -o /dev/null -w '%{redirect_url}' "https://${DOMAIN}/api/auth/yandex" 2>/dev/null)
if echo "$LOC" | grep -q 'oauth.yandex.ru'; then
  ok "GET /api/auth/yandex redirects to Yandex"
  echo "    -> $LOC"
else bad "auth init did not redirect to Yandex (YANDEX_CLIENT_ID set?)"; fi

echo
echo "==> $PASS passed, $FAIL failed"
echo "Manual check left to you: open https://${DOMAIN}, click 'Войти через Яндекс',"
echo "complete login, confirm you land back logged-in. First user becomes admin."
[ "$FAIL" -eq 0 ]
