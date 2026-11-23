#!/usr/bin/env bash
# Run by .github/workflows/collect.yml (never by hand on main). One collector run, then publish its public output to the
# orphan branch `data` of this repository (never main):
#   1. fetch the previous copy from `data` (when the branch exists) into a temporary CURITIBAI_DATA_DIR, so the
#      collector's ratio check and "a failed run keeps the previous files" work as on a local machine;
#   2. run scripts/fetch-events.mjs once (same robots.txt, window and 5 s rules; no retry inside the run), with
#      CURITIBAI_COLLECT_ONCE_A_DAY=1: when both steps already succeeded on this UTC date (an earlier schedule entry),
#      it makes no request and writes nothing;
#   3. commit only events/events.json, events/status.json, phones/phones.json and phones/status.json (facts, links and
#      result codes only), skipping the commit and the push when none changed, and push without force. A failed
#      collector run writes only the status.json files, so only those change. A skipped run, and a run stopped by the
#      window (GitHub started it late), write nothing, so they never commit. A push rejected because
#      receita-version.yml moved `data` meanwhile is redone once on the new tip (fetch, reset, copy, commit again);
#      a second rejection exits 1. Both workflows share the concurrency group `data-branch`, so this is rare.
# Exits with the collector's exit code (after publishing), so a failed run shows red in Actions. A run outside the
# window exits 0 only while both steps succeeded in the last 24 h.
# Needs GITHUB_REPOSITORY and GH_TOKEN (contents: write); the token is passed to git only, never to the collector.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is not set}"
: "${GH_TOKEN:?GH_TOKEN is not set}"
BRANCH=data
FILES=(events/events.json events/status.json phones/phones.json phones/status.json)

work="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/curitibai-collect.XXXXXX")"
trap 'rm -rf "$work"' EXIT
data="$work/data-dir"
pub="$work/publish"
mkdir -p "$data" "$pub"

auth="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GH_TOKEN" | base64 | tr -d '\n')"
pubgit() { git -C "$pub" -c "http.https://github.com/.extraheader=$auth" "$@"; }

git -C "$pub" init -q
git -C "$pub" remote add origin "https://github.com/${GITHUB_REPOSITORY}.git"
rc=0
pubgit ls-remote --exit-code origin "refs/heads/$BRANCH" >/dev/null || rc=$?
if [[ $rc == 0 ]]; then
  pubgit fetch -q --depth=1 origin "refs/heads/$BRANCH"
  git -C "$pub" checkout -q -b "$BRANCH" FETCH_HEAD
elif [[ $rc == 2 ]]; then
  echo "publish-data: no '$BRANCH' branch yet; this run creates it (orphan)"
  git -C "$pub" checkout -q --orphan "$BRANCH"
else
  echo "publish-data: could not list the remote branches (git exit $rc); nothing collected" >&2
  exit 1
fi

for f in "${FILES[@]}"; do
  if [[ -f "$pub/$f" ]]; then
    mkdir -p "$data/$(dirname "$f")"
    cp "$pub/$f" "$data/$f"
  fi
done

code=0
env -u GH_TOKEN CURITIBAI_DATA_DIR="$data" CURITIBAI_COLLECT_ONCE_A_DAY=1 node scripts/fetch-events.mjs || code=$?

# Two tries: a push rejected because another run (receita-version.yml) moved `data` meanwhile is redone once on the
# new tip; the files never overlap, so only the four files above are copied again from the collector's folder.
for attempt in 1 2; do
  changed=()
  for f in "${FILES[@]}"; do
    if [[ -f "$data/$f" ]]; then
      mkdir -p "$pub/$(dirname "$f")"
      cp "$data/$f" "$pub/$f"
      changed+=("$f")
    fi
  done
  if (( ${#changed[@]} > 0 )); then
    git -C "$pub" add -- "${changed[@]}"
  fi
  if [[ -z "$(git -C "$pub" status --porcelain)" ]]; then
    echo "publish-data: nothing changed; no commit"
    break
  fi
  git -C "$pub" -c user.name="github-actions[bot]" \
    -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit -q -m "data: nightly collection $(date -u +%Y-%m-%dT%H:%MZ) (collector exit $code)"
  if pubgit push -q origin "HEAD:refs/heads/$BRANCH"; then
    echo "publish-data: pushed to '$BRANCH'"
    break
  fi
  if [[ $attempt == 2 ]]; then
    echo "publish-data: push rejected twice; this run's files not published" >&2
    exit 1
  fi
  echo "publish-data: push rejected; fetching '$BRANCH' again and retrying once"
  if ! pubgit fetch -q --depth=1 origin "refs/heads/$BRANCH" || ! git -C "$pub" reset -q --hard FETCH_HEAD; then
    echo "publish-data: could not fetch '$BRANCH' again; this run's files not published" >&2
    exit 1
  fi
done
exit "$code"
