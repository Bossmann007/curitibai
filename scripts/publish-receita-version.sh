#!/usr/bin/env bash
# Run by .github/workflows/receita-version.yml (never by hand). Same mechanism as scripts/publish-data.sh, for one file:
#   1. fetch the `data` branch (when it exists) and copy its receita/version.json into a temporary CURITIBAI_DATA_DIR;
#   2. run scripts/check-receita-version.mjs once (it opens the issue itself when the version changed);
#   3. commit only receita/version.json when it changed and push without force. events/ and phones/ are never touched,
#      so the nightly collection's files stay as they are.
# Exits with the checker's exit code (after publishing). Needs GITHUB_REPOSITORY and GH_TOKEN (contents: write for the
# push, issues: write for the checker; the checker sends the token to api.github.com only).
set -euo pipefail
cd "$(dirname "$0")/.."

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is not set}"
: "${GH_TOKEN:?GH_TOKEN is not set}"
BRANCH=data
FILE=receita/version.json

work="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/curitibai-receita.XXXXXX")"
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
  echo "publish-receita-version: no '$BRANCH' branch yet; this run creates it (orphan)"
  git -C "$pub" checkout -q --orphan "$BRANCH"
else
  echo "publish-receita-version: could not list the remote branches (git exit $rc); nothing checked" >&2
  exit 1
fi

if [[ -f "$pub/$FILE" ]]; then
  mkdir -p "$data/$(dirname "$FILE")"
  cp "$pub/$FILE" "$data/$FILE"
fi

code=0
CURITIBAI_DATA_DIR="$data" node scripts/check-receita-version.mjs || code=$?

# Two tries: a push rejected because another run (collect.yml) moved `data` meanwhile is redone once on the new tip;
# the files never overlap, so only receita/version.json is copied again.
for attempt in 1 2; do
  if [[ -f "$data/$FILE" ]]; then
    mkdir -p "$pub/$(dirname "$FILE")"
    cp "$data/$FILE" "$pub/$FILE"
    git -C "$pub" add -- "$FILE"
  fi
  if [[ -z "$(git -C "$pub" status --porcelain -- "$FILE")" ]]; then
    echo "publish-receita-version: nothing changed; no commit"
    break
  fi
  git -C "$pub" -c user.name="github-actions[bot]" \
    -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit -q -m "data: Receita calculator version $(date -u +%Y-%m-%d) (checker exit $code)" -- "$FILE"
  if pubgit push -q origin "HEAD:refs/heads/$BRANCH"; then
    echo "publish-receita-version: pushed to '$BRANCH'"
    break
  fi
  if [[ $attempt == 2 ]]; then
    echo "publish-receita-version: push rejected twice; version.json not published" >&2
    exit 1
  fi
  echo "publish-receita-version: push rejected; fetching '$BRANCH' again and retrying once"
  pubgit fetch -q --depth=1 origin "refs/heads/$BRANCH"
  git -C "$pub" reset -q --hard FETCH_HEAD
done
exit "$code"
