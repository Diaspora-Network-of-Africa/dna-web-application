#!/usr/bin/env bash
# One migration file, from one named commit, into the canonical project's ledger and schema in one
# transaction (handoff 62-MIG, ruling 1827; 562, 225, 466, 553). Run by .github/workflows/migrate.yml
# after the founder approves the run in the canonical-migrations Environment, and by nothing else.
#
#   MODE=rehearse|apply VERSION=<14 digits> REF=<40-hex sha> MIGRATE_DB_URL=postgres://... \
#     ACTOR=<who dispatched> APPROVER=<who approved> scripts/migrate.sh
#
# This script, and everything else the job executes, runs from the workflow's own commit: the
# default branch the run was dispatched from, which is what the checkout holds. Only the migration
# file is read out of REF, with `git show REF:path`, never by checking REF out, so a branch that
# carries a different script, or none (#116's head carries no scripts/migrate.sh), changes nothing
# about what runs. The file's bytes are proven to be REF's by their blob hash. Every refusal is red
# with its reason in the log, and nothing is written before the refusals are passed. Nothing here
# amends, renames or regenerates a migration file (466).
#
# Refusals, in order: an input that is not its shape; REF is not a commit this repository holds, or
# is on no branch of it; not exactly one supabase/migrations/{VERSION}_*.sql at REF; the extracted
# bytes do not hash to REF's blob; the file carries its own transaction statements (this run
# supplies the transaction, so a `begin;` or `commit;` in the file would split it); the version is
# already in supabase_migrations.schema_migrations (apply); the version is not later than the
# ledger's head (both modes).
#
# Rehearse and apply run the same script: begin; insert the ledger row (version, the file name's
# suffix as name, statements as a one-element array holding the file's exact bytes, dollar-quoted);
# the file itself, through \i; a check that md5(statements[1]) for the version equals the md5 of
# the file on disk, raising if not; then rollback (rehearse) or commit (apply). ON_ERROR_STOP is on,
# so the first error ends the session and the transaction with it. After an apply the ledger md5
# is read back on a fresh connection and printed with the version, the file's sha256 and md5, the
# actor and the approver.
#
# psql reads the file, so two things the SQL Editor did not care about matter here: a line starting
# with a backslash is a meta-command, and `:name` outside quotes is a variable reference. No
# migration in the tree carries either, and the ledger row's dollar quote is exempt from both.
set -euo pipefail

say() { printf '%s\n' "$*"; }
refuse() {
  printf '::error::%s\n' "$*"
  say "REFUSED  $*"
  exit 1
}

MODE="${MODE:-}"
VERSION="${VERSION:-}"
REF="${REF:-}"
ACTOR="${ACTOR:-unknown}"
APPROVER="${APPROVER:-unknown}"

case "$MODE" in
  rehearse | apply) ;;
  *) refuse "mode must be rehearse or apply, not '${MODE}'" ;;
esac
[[ "$VERSION" =~ ^[0-9]{14}$ ]] || refuse "version must be 14 digits, not '${VERSION}'"
[[ "$REF" =~ ^[0-9a-f]{40}$ ]] || refuse "ref must be a full 40-character lowercase commit sha, not '${REF}'"
[ -n "${MIGRATE_DB_URL:-}" ] || refuse "MIGRATE_DB_URL is not set; the job reads it from the canonical-migrations Environment and nowhere else"
command -v psql > /dev/null || refuse "psql is not installed on this runner"

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
say "running scripts/migrate.sh from the workflow's checkout at $(git rev-parse HEAD); the file is read out of ${REF}"

git cat-file -e "${REF}^{commit}" 2> /dev/null || refuse "ref ${REF} is not a commit this repository holds"
branches="$(git branch -r --contains "$REF" 2> /dev/null | sed 's/^[ *]*//' | grep -v -- '->' || true)"
[ -n "$branches" ] || refuse "ref ${REF} is not an ancestor of any branch in the repository"
say "ref ${REF} is on: $(printf '%s' "$branches" | tr '\n' ' ')"

mapfile -t matches < <(git ls-tree -r --name-only "$REF" -- supabase/migrations/ | grep -E "^supabase/migrations/${VERSION}_[^/]+\.sql$" || true)
case "${#matches[@]}" in
  0) refuse "no file supabase/migrations/${VERSION}_*.sql at ${REF}" ;;
  1) ;;
  *) refuse "${#matches[@]} files carry version ${VERSION} at ${REF}: ${matches[*]}; Supabase matches by version only" ;;
esac
FILE="${matches[0]}"
BASENAME="$(basename "$FILE")"
NAME="${BASENAME#"${VERSION}"_}"
NAME="${NAME%.sql}"
[[ "$NAME" =~ ^[A-Za-z0-9_.-]+$ ]] || refuse "the file name's suffix '${NAME}' carries a character outside [A-Za-z0-9_.-]"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# The file's bytes, out of REF and never out of the working tree, proven by the blob hash.
LOCAL="$WORK/$BASENAME"
git show "${REF}:${FILE}" > "$LOCAL" || refuse "could not read ${FILE} out of ${REF}"
BLOB="$(git rev-parse "${REF}:${FILE}")"
HASHED="$(git hash-object "$LOCAL")"
[ "$BLOB" = "$HASHED" ] || refuse "the bytes read for ${FILE} hash to ${HASHED}, not ${REF}'s blob ${BLOB}"

if grep -nEiq '^[[:space:]]*(begin|start[[:space:]]+transaction|commit|rollback)[[:space:]]*;' "$LOCAL"; then
  grep -nEi '^[[:space:]]*(begin|start[[:space:]]+transaction|commit|rollback)[[:space:]]*;' "$LOCAL" | head -5
  refuse "${FILE} carries its own transaction statement; this run supplies the one transaction the ledger row and the file share"
fi

SHA256="$(sha256sum "$LOCAL" | cut -d' ' -f1)"
MD5="$(md5sum "$LOCAL" | cut -d' ' -f1)"
BYTES="$(wc -c < "$LOCAL" | tr -d ' ')"
say "mode ${MODE}; version ${VERSION}; file ${FILE} at ${REF} (${BYTES} bytes, blob ${BLOB}); name ${NAME}"
say "sha256 ${SHA256}"
say "md5    ${MD5}  (the raw md5 of the file's bytes)"

PSQL=(psql "$MIGRATE_DB_URL" -X -q -v ON_ERROR_STOP=1 -At)

# The ledger before anything is written: is the version there, and what is the head.
ledger="$("${PSQL[@]}" -c "select coalesce(bool_or(version = '${VERSION}'), false)::text || '|' || coalesce(max(version), '') from supabase_migrations.schema_migrations")" \
  || refuse "could not read supabase_migrations.schema_migrations"
present="${ledger%%|*}"
head="${ledger#*|}"
say "ledger head ${head:-(empty)}; version ${VERSION} present: ${present}"
if [ "$MODE" = apply ] && [ "$present" = true ]; then
  refuse "version ${VERSION} is already in supabase_migrations.schema_migrations; an applied file is never applied again, and a change is a new migration (466)"
fi
if [ -n "$head" ] && ! [[ "$VERSION" > "$head" ]]; then
  refuse "version ${VERSION} is not later than the ledger head ${head}"
fi

# A dollar-quote tag the file does not contain, so the ledger row holds the file's exact bytes.
tag="migrate_$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')"
while grep -q -- "\$${tag}\$" "$LOCAL"; do
  tag="migrate_$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')"
done

SCRIPT="$WORK/${MODE}.sql"
{
  printf '\\set ON_ERROR_STOP on\n'
  printf 'begin;\n'
  printf "insert into supabase_migrations.schema_migrations (version, name, statements)\nvalues ('%s', '%s', array[\$%s\$" "$VERSION" "$NAME" "$tag"
  cat "$LOCAL"
  printf '$%s$]);\n' "$tag"
  printf '\\echo ledger row inserted for %s, now the file\n' "$VERSION"
  printf '\\i %s\n' "$LOCAL"
  printf '\\echo file ran, now the md5 check\n'
  cat <<SQL
do \$migrate_check\$
declare recorded text;
begin
  select md5(statements[1]) into recorded
    from supabase_migrations.schema_migrations where version = '${VERSION}';
  if recorded is distinct from '${MD5}' then
    raise exception 'ledger md5 % for version ${VERSION} differs from the file md5 ${MD5}; nothing is committed', recorded;
  end if;
  raise notice 'ledger md5 % equals the file md5 (version ${VERSION})', recorded;
end
\$migrate_check\$;
SQL
  if [ "$MODE" = apply ]; then
    printf 'commit;\n'
  else
    printf 'rollback;\n'
  fi
} > "$SCRIPT"

say "=== ${MODE}: begin, ledger row, ${BASENAME}, md5 check, $([ "$MODE" = apply ] && echo commit || echo rollback) ==="
if ! psql "$MIGRATE_DB_URL" -X -v ON_ERROR_STOP=1 -f "$SCRIPT" 2>&1; then
  if [ "$MODE" = apply ]; then
    refuse "apply of ${VERSION} failed before commit; the session ended and the transaction rolled back, so neither the ledger row nor the file's statements were kept"
  fi
  refuse "rehearse of ${VERSION} failed; nothing was written"
fi

if [ "$MODE" = rehearse ]; then
  after="$("${PSQL[@]}" -c "select count(*) from supabase_migrations.schema_migrations where version = '${VERSION}'")"
  [ "$after" = 0 ] || refuse "rehearse left a ledger row for ${VERSION} behind, which it must never do"
  say "REHEARSED ${VERSION} ${BASENAME}: ran to the end and rolled back; the ledger holds no row for it"
  say "actor ${ACTOR}; approver ${APPROVER}"
  exit 0
fi

ledger_md5="$("${PSQL[@]}" -c "select md5(statements[1]) from supabase_migrations.schema_migrations where version = '${VERSION}'")"
[ "$ledger_md5" = "$MD5" ] || refuse "after commit the ledger md5 for ${VERSION} reads '${ledger_md5}', not the file's ${MD5}: drift, named now rather than at the next drift run (444)"
say "APPLIED ${VERSION} ${BASENAME}"
say "  file sha256  ${SHA256}"
say "  file md5     ${MD5}"
say "  ledger md5   ${ledger_md5}  (read back after commit on a fresh connection)"
say "  actor        ${ACTOR}"
say "  approver     ${APPROVER}"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Migration applied (handoff 62-MIG, ruling 1827)"
    echo ""
    echo "| | |"
    echo "| --- | --- |"
    echo "| version | \`${VERSION}\` |"
    echo "| file | \`${FILE}\` at \`${REF}\` |"
    echo "| file sha256 | \`${SHA256}\` |"
    echo "| file md5 | \`${MD5}\` |"
    echo "| ledger md5 | \`${ledger_md5}\` |"
    echo "| actor | ${ACTOR} |"
    echo "| approver | ${APPROVER} |"
  } >> "$GITHUB_STEP_SUMMARY"
fi
