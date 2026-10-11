#!/bin/sh
body=null
failed=
filter=.
pages=.

for arg; do
  case $flag in
    --input) body=$(jq --compact-output . "$arg") ;;
    --jq)    filter=$arg ;;
  esac
  case $arg in
    "${GH_FAIL:-}") failed=1 ;;
    --paginate)     pages='.[]' ;;
    --silent)       filter=empty ;;
    --slurp)        pages=. ;;
  esac
  flag=$arg
done

jq \
  --argjson body "$body" \
  --compact-output \
  --null-input \
  '{ args: $ARGS.positional, body: $body }' \
  --args -- "$@" >> "$GH_LOG"

[ -z "$failed" ] || exit 1
[ "$1" != release ] || [ -z "${GH_CREATED:-}" ] || printf '%s\n' "$GH_CREATED"
[ "$1" = api ] || exit 0

printf '%s' "${GH_LIVE:-null}" \
  | jq --arg endpoint "$arg" --raw-output ".[\$endpoint] // empty | $pages | $filter"
