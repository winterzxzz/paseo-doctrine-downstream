#!/usr/bin/env bash
# Helpers for integrating an upstream getpaseo/paseo stable tag into this downstream.
# The procedure and the resolution rules live in docs/upstream-integration.md.
#
#   scripts/upstream-integration.sh survey v0.9.0        fetch the tag, report divergence and a dry-run conflict map
#   scripts/upstream-integration.sh changed-tests [base] list unit test files changed since base (default: origin/main)
#   scripts/upstream-integration.sh run-tests [base]     run those files, one vitest invocation per package
#   scripts/upstream-integration.sh stale-markers        fail when conflict markers remain in tracked sources
#
# Nothing here merges, commits, or pushes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM_URL="https://github.com/getpaseo/paseo.git"
OUT_DIR="${UPSTREAM_INTEGRATION_OUT:-$ROOT/.dev/upstream-integration}"

say() { printf '%s\n' "$*"; }
fail() { printf 'upstream-integration: %s\n' "$*" >&2; exit 1; }

ensure_remote() {
  git -C "$ROOT" remote get-url upstream >/dev/null 2>&1 ||
    git -C "$ROOT" remote add upstream "$UPSTREAM_URL"
}

survey() {
  local tag="${1:-}"
  [ -n "$tag" ] || fail "usage: survey <upstream-tag>, for example v0.9.0"
  local local_tag="upstream-$tag"
  ensure_remote
  # Upstream tags live under upstream-<tag> so they never collide with paseo-v* downstream tags.
  git -C "$ROOT" fetch --no-tags upstream "refs/tags/$tag:refs/tags/$local_tag"
  local target base
  target="$(git -C "$ROOT" rev-parse "$local_tag^{commit}")"
  base="$(git -C "$ROOT" merge-base HEAD "$target")"
  say "upstream tag      $tag -> $target"
  say "merge base        $(git -C "$ROOT" log -1 --format='%h %ad %s' --date=short "$base")"
  say "downstream ahead  $(git -C "$ROOT" rev-list --count "$base..HEAD") commits"
  say "upstream ahead    $(git -C "$ROOT" rev-list --count "$base..$target") commits"
  say "upstream version  $(git -C "$ROOT" show "$target:package.json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).version))')"
  say "upstream license  $(git -C "$ROOT" show "$target:package.json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).license))')"
  say ""
  local report
  report="$(git -C "$ROOT" merge-tree --write-tree --name-only HEAD "$target" || true)"
  local conflicts
  conflicts="$(printf '%s\n' "$report" | grep -c '^CONFLICT' || true)"
  say "dry-run conflicts $conflicts"
  printf '%s\n' "$report" | grep '^CONFLICT' | sed -E 's/.* in //' |
    awk -F/ '{ print ($1 == "packages" ? $1"/"$2 : $1) }' | sort | uniq -c | sort -rn
  say ""
  say "next: git switch -c integrate-upstream-$tag && git merge --no-ff --no-commit $local_tag"
}

changed_tests() {
  local base="${1:-origin/main}"
  git -C "$ROOT" diff --name-only "$base" HEAD |
    grep -E '\.test\.(ts|tsx)$' |
    grep -vE '(^|/)e2e/|\.browser\.|\.real\.|\.live-daemon\.|^packages/cli/tests/' || true
}

run_tests() {
  local base="${1:-origin/main}"
  mkdir -p "$OUT_DIR"
  local list="$OUT_DIR/changed-tests.txt"
  changed_tests "$base" > "$list"
  say "$(wc -l < "$list" | tr -d ' ') changed unit test files since $base (list: $list)"
  local status=0 pkg
  for pkg in $(cut -d/ -f2 "$list" | sort -u); do
    local files=()
    while IFS= read -r file; do
      [ -f "$ROOT/packages/$pkg/$file" ] && files+=("$file")
    done < <(grep "^packages/$pkg/" "$list" | sed "s|^packages/$pkg/||")
    [ ${#files[@]} -eq 0 ] && continue
    local log="$OUT_DIR/test-$pkg.txt"
    # PASEO_FORCE_BYPASS=0 restores role enforcement the server tests assert on. The webstorage flag
    # keeps Node 25's built-in localStorage from shadowing jsdom's in app tests.
    if ( cd "$ROOT/packages/$pkg" &&
      PASEO_FORCE_BYPASS=0 NODE_OPTIONS="${NODE_OPTIONS:-} --no-experimental-webstorage" \
        npx vitest run "${files[@]}" > "$log" 2>&1 ); then
      say "PASS $pkg (${#files[@]} files) $(grep -E '^ +Tests ' "$log" | tr -s ' ')"
    else
      status=1
      say "FAIL $pkg (${#files[@]} files) $(grep -E '^ +Tests ' "$log" | tr -s ' ') -> $log"
      grep -E '^ FAIL ' "$log" | sed -E 's/ > .*//' | sort -u | head -20
    fi
  done
  return $status
}

stale_markers() {
  local hits
  hits="$(git -C "$ROOT" grep -lE '^(<<<<<<< |>>>>>>> )' -- . ':!*.md' ':!scripts/upstream-integration.sh' || true)"
  [ -z "$hits" ] || { printf '%s\n' "$hits"; fail "conflict markers remain"; }
  say "no conflict markers"
}

case "${1:-}" in
  survey) shift; survey "$@" ;;
  changed-tests) shift; changed_tests "$@" ;;
  run-tests) shift; run_tests "$@" ;;
  stale-markers) stale_markers ;;
  *) sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
