#!/usr/bin/env bash
# Ruling 217: the gate depends only on what the project uses, and its gating steps retry.
#
# Every path the suites open in a browser or fetch over REST is confirmed to serve from the
# deployment before any suite runs, and every one of them is polled rather than fetched once.
# Run 86 returned 404 on a single unretried GET of /connect seconds after a fresh direct upload and
# took the whole matrix with it while every assertion that had run passed. The paths added after
# that fix were still single GETs, so the same failure was one propagation delay away on any of
# them. One place, one policy.
#
# Usage: BASE=https://<deployment> scripts/deployment-serves.sh
#        BASE=https://<deployment> APP=admin scripts/deployment-serves.sh   (handoff 40-B: the admin host)
set -uo pipefail

BASE="${BASE:?BASE is required}"
BASE="${BASE%/}"
TRIES="${TRIES:-12}"
DELAY="${DELAY:-10}"
failed=0

# Polls one path until it answers 200, or gives up and marks the run failed. Never exits itself:
# the report names every path that did not serve, rather than the first.
serves() {
  local path="$1" out="${2:-/dev/null}" code=000 i
  for ((i = 1; i <= TRIES; i++)); do
    code=$(curl -sS -o "$out" -w '%{http_code}' --max-time 30 "$BASE$path" || echo 000)
    [ "$code" = "200" ] && break
    [ "$i" -lt "$TRIES" ] && sleep "$DELAY"
  done
  echo "GET $path -> $code"
  [ "$code" = "200" ] || failed=1
}

# Polls one path until it redirects to the location named, so a route that moved is still confirmed
# to serve. Handoff 61-S1 (ruling 230, finding 3): /password is a 307 into the Account drawer's
# password level at /settings/security, and the suites open it for that redirect.
redirects() {
  local path="$1" to="$2" code=000 loc="" i
  for ((i = 1; i <= TRIES; i++)); do
    code=$(curl -sS -o /dev/null -D /tmp/redirect-headers -w '%{http_code}' --max-time 30 "$BASE$path" || echo 000)
    loc=$(grep -i '^location:' /tmp/redirect-headers 2>/dev/null | head -1 | tr -d '\r' | awk '{print $2}')
    case "$code" in 301 | 302 | 307 | 308) [[ "$loc" == *"$to"* ]] && break ;; esac
    [ "$i" -lt "$TRIES" ] && sleep "$DELAY"
  done
  echo "GET $path -> $code ${loc:-no location}"
  case "$code" in
    301 | 302 | 307 | 308) [[ "$loc" == *"$to"* ]] || failed=1 ;;
    *) failed=1 ;;
  esac
}

echo "Confirming $BASE serves every path the suites open"

# Handoff 40-B section 6: the admin host serves these paths and nothing of the member app's;
# handoff 45-D adds /settings, which the Settings arms open.
if [ "${APP:-member}" = "admin" ]; then
  serves /sign-in /tmp/admin-sign-in.html
  serves /
  serves /settings
  serves /strand/logo.png
  # 1892, 1902: the console and the admin sign-in draw the wordmark; 1885: the dark tab icon.
  serves /strand/wordmark-mono.svg
  serves /favicon.ico /tmp/admin-favicon.ico
  serves /favicon-dark.png
  serves /robots.txt /tmp/admin-robots.txt
  if [ "$failed" -ne 0 ]; then
    echo "::error::The admin deployment did not serve every path the arms open. Nothing was tested."
    exit 1
  fi
  grep -q '<title>DNA Admin</title>' /tmp/admin-sign-in.html || { echo "::error::/sign-in is not the admin app"; exit 1; }
  ! grep -q 'manifest.webmanifest' /tmp/admin-sign-in.html || { echo "::error::the admin sign-in links the member app's manifest"; exit 1; }
  grep -q '^Disallow: /$' /tmp/admin-robots.txt || { echo "::error::/robots.txt does not refuse every crawler"; exit 1; }
  [ "$(head -c 4 /tmp/admin-favicon.ico | od -An -tx1 | tr -d ' \n')" = "00000100" ] || { echo "::error::/favicon.ico is not an ICO"; exit 1; }
  echo "The admin deployment serves every path the arms open."
  exit 0
fi

serves /sign-in /tmp/sign-in.html
serves /connect /dev/null
# Brief 4B's routes, opened by tests/auth.cjs.
serves /reset
serves /reset/new
# Handoff 61-S1: /password redirects into the Account drawer, whose routes tests/account.cjs opens.
redirects /password /settings/security
serves /settings
serves /settings/security
# Brief 5's routes, opened by tests/onboarding.cjs.
serves /welcome
serves /where
serves /relationship
# Brief 9's Discovery and the C stub beside it, opened by tests/discovery.cjs (handoff 31-B).
serves /convene
serves /collaborate
# Brief 10's member event page, opened by tests/event.cjs; the shell serves it signed out too.
serves /convene/events/00000000-0000-4000-8000-000000000000
# 1891: the brand slot's glyph (C_GLYPH.brand), which took over from the retired mate-masie.svg.
serves /strand/adinkra/dna-icon.svg
# Handoff 32-A's mount arms (tests/mount.cjs) open these by document load; the shell, profile and
# Discovery suites open them too and were not listed here.
serves /feed
serves /posts/seed-1
serves /m/thandiwe-dube
serves /convene/curated
# Ruling 184's asset contract: every path in the table serves, so the redesign stays a file
# overwrite. Ruling 1246 (handoff 38-A) returns favicon.ico to the contract, generated from
# icon-512.png: browsers fetch it unasked, and a 404 there left tabs on the icon cached for the host
# before 1139 (Lovable's).
# 1892, 1902: logo.png is the email lockup, served at its path; every component draws the wordmark.
serves /strand/logo.png
serves /strand/wordmark-mono.svg
serves /favicon.ico /tmp/favicon.ico
serves /favicon.png
serves /favicon-dark.png
serves /apple-touch-icon.png
serves /icon-192.png
serves /icon-512.png
serves /manifest.webmanifest /tmp/manifest.json
# Ruling 387: security.txt is served by the worker entry from the contact module, not from public/.
serves /.well-known/security.txt /tmp/security.txt

if [ "$failed" -ne 0 ]; then
  echo "::error::The deployment did not serve every path the suites open. Nothing was tested."
  exit 1
fi

# Content, not just status: a 200 that is not the app is the failure a status check cannot see.
grep -q '<title>DNA</title>' /tmp/sign-in.html || { echo "::error::/sign-in is not the app"; exit 1; }
grep -q 'manifest.webmanifest' /tmp/sign-in.html || { echo "::error::/sign-in links no manifest"; exit 1; }
grep -q '/icon-192.png' /tmp/manifest.json || { echo "::error::manifest names no 192 icon"; exit 1; }
grep -q '/icon-512.png' /tmp/manifest.json || { echo "::error::manifest names no 512 icon"; exit 1; }
! grep -q 'mate-masie' /tmp/manifest.json || { echo "::error::manifest still names the Adinkra mark"; exit 1; }
# Handoff 38-A: /favicon.ico is an ICO served as an image, and the head links it before favicon.png.
case "$(curl -sS -o /dev/null -w '%{content_type}' --max-time 30 "$BASE/favicon.ico")" in
  image/*) ;;
  *) echo "::error::/favicon.ico is not served with an image content type"; exit 1 ;;
esac
[ "$(head -c 4 /tmp/favicon.ico | od -An -tx1 | tr -d ' \n')" = "00000100" ] || { echo "::error::/favicon.ico is not an ICO"; exit 1; }
grep -q 'href="/favicon.ico"' /tmp/sign-in.html || { echo "::error::/sign-in links no favicon.ico"; exit 1; }
ico_at=$(grep -abo 'href="/favicon.ico"' /tmp/sign-in.html | head -1 | cut -d: -f1)
png_at=$(grep -abo 'href="/favicon.png"' /tmp/sign-in.html | head -1 | cut -d: -f1)
[ -n "$png_at" ] && [ "$ico_at" -lt "$png_at" ] || { echo "::error::/sign-in does not link favicon.ico before favicon.png"; exit 1; }
grep -q '^Contact: mailto:' /tmp/security.txt || { echo "::error::/.well-known/security.txt carries no Contact"; exit 1; }

echo "The deployment serves every path the suites open."
