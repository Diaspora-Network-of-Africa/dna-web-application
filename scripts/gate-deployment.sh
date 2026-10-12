#!/usr/bin/env bash
# Ruling 1735 (handoff 61-CI): the macOS gate runs from a pull_request event, and that event uploads
# nothing. The head it gates was deployed by pages.yml's own push run, with --commit-hash set to the
# head's SHA and --branch to its branch, so this asks Cloudflare for that deployment and answers its
# own URL, https://<id>.dna-web-application.pages.dev (1141). It never answers the branch alias and
# never builds a host from the branch name, and a merge ref was never deployed, so none can be found.
#
# On a push to a ready pull request the push run is still building when this starts, so the lookup
# polls until the deployment's last stage has succeeded, and fails by name when none arrives.
#
# Usage: SHA=<head sha> BRANCH=<head branch> PROJECT=<pages project> \
#        CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... scripts/gate-deployment.sh
# Writes url=<deployment URL> to the step's GITHUB_OUTPUT.
set -uo pipefail

SHA="${SHA:?SHA is required}"
BRANCH="${BRANCH:?BRANCH is required}"
PROJECT="${PROJECT:?PROJECT is required}"
TRIES="${TRIES:-60}"
DELAY="${DELAY:-20}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "::error::CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID is empty, so the deployment of $SHA cannot be looked up. A pull request from a fork gets no secrets."
  echo "No deployment looked up: the Cloudflare secrets are not available to this run." >> "$SUMMARY"
  exit 1
fi

api="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJECT/deployments"
url=""
for ((i = 1; i <= TRIES; i++)); do
  body=$(curl -sS --max-time 30 -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "$api" || true)
  # Newest first. The deployment's own URL, never one of its aliases (1141).
  url=$(printf '%s' "$body" | jq -r --arg sha "$SHA" --arg br "$BRANCH" '
    [ .result[]?
      | select(.deployment_trigger.metadata.commit_hash == $sha
               and .deployment_trigger.metadata.branch == $br
               and .latest_stage.name == "deploy"
               and .latest_stage.status == "success")
      | select(.url as $u | (.aliases // []) | index($u) | not)
      | .url ] | first // empty' 2>/dev/null || true)
  [ -n "$url" ] && break
  if [ "$(printf '%s' "$body" | jq -r '.success // false' 2>/dev/null)" != "true" ]; then
    echo "Attempt $i: Cloudflare did not answer the deployments list successfully."
  else
    echo "Attempt $i: no finished deployment of $SHA on $BRANCH yet."
  fi
  [ "$i" -lt "$TRIES" ] && sleep "$DELAY"
done

if [ -z "$url" ]; then
  echo "::error::No finished deployment of $SHA on $BRANCH after $TRIES attempts. pages.yml's push run for this head uploads it; if its deploy job failed or was cancelled, there is nothing to gate."
  echo "None: no finished deployment of \`$SHA\` on \`$BRANCH\` was found. pages.yml's push run for this head uploads it." >> "$SUMMARY"
  exit 1
fi
echo "Deployment of $SHA on $BRANCH: $url"
if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "url=${url%/}" >> "$GITHUB_OUTPUT"; fi
