#!/usr/bin/env bash
# Ruling 1141 (G126): a test job names the host it reads, in its log and in its job summary, before
# anything reads it, so each reading is tied to one deployment in the run itself (811, 893).
#
# BASE is that host, and KIND says where it came from:
#   push      pages.yml: the deployment the same run uploaded, at its own URL,
#             https://<id>.dna-web-application.pages.dev.
#   dispatch  matrix.yml and webkit-crash.yml: the base_url the dispatch names, which is required.
#   pr        webkit-macos.yml (ruling 1735): the deployment pages.yml's push run uploaded for the
#             pull request's head, at its own URL, found by scripts/gate-deployment.sh. HEAD_SHA
#             names that head, because on a pull_request event GITHUB_SHA is the merge ref's commit.
# Nothing here builds a host from the branch name. The one host a branch name gives is its alias, a
# pointer Cloudflare moves between deployments, and on run 361 it answered 404 on every route for
# about ninety minutes, across two deployments of one build, then cleared with nothing done. So an
# empty BASE fails by name and is never a guess: on a push it means the deploy job returned no URL,
# and on a dispatch it refuses the run.
#
# Usage: BASE=<url> KIND=push|dispatch|pr [HEAD_SHA=<sha>] scripts/host-tested.sh
# Writes url=<BASE without a trailing slash> to the step's GITHUB_OUTPUT.
set -uo pipefail

BASE="${BASE:-}"
BASE="${BASE%/}"
SHA="${HEAD_SHA:-${GITHUB_SHA:-unknown}}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

case "${KIND:-}" in
  push)
    from="the deployment this run uploaded, built from \`$SHA\`"
    missing="the deploy job returned no URL for the deployment it uploaded, so there is nothing to test."
    ;;
  dispatch)
    from="from the dispatch's \`base_url\`, read by the tests at \`$SHA\`"
    missing="this dispatch names no \`base_url\`, and no host is built from the branch name. Dispatch again with \`base_url\` set to the deployment's own URL, \`https://<id>.dna-web-application.pages.dev\`, which the Host tested block of the push run that uploaded it names."
    ;;
  pr)
    from="the deployment pages.yml's push run uploaded for this pull request's head, built from \`$SHA\`"
    missing="no deployment of this pull request's head was found, so there is nothing to test."
    ;;
  *)
    echo "::error::scripts/host-tested.sh: KIND is push, dispatch or pr, not '${KIND:-}'"
    exit 1
    ;;
esac

{
  echo "### Host tested (ruling 1141)"
  echo ""
} >> "$SUMMARY"
# The summary is Markdown and the log is not, so the log drops the backticks.
if [ -z "$BASE" ]; then
  echo "::error::No host to test: ${missing//\`/}"
  echo "None: $missing" >> "$SUMMARY"
  exit 1
fi
echo "Host tested: $BASE, ${from//\`/}"
echo "\`$BASE\`, $from." >> "$SUMMARY"
if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "url=$BASE" >> "$GITHUB_OUTPUT"; fi
