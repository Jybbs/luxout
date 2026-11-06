#!/bin/sh
program=$(basename "$0")

jq \
  --arg cwd "$PWD" \
  --compact-output \
  --null-input \
  '{ args: $ARGS.positional, cwd: $cwd }' \
  --args -- "$program" "$@" >> "$CANNED_LOG"

answer=$(
  printf '%s' "${CANNED:-null}" \
    | jq --arg key "$program $*" --compact-output '.[$key] // empty'
)

if [ -z "$answer" ]; then
  PATH=${PATH#*:}
  exec "$program" "$@"
fi

breaks=$(printf '%s' "$answer" | jq --raw-output '.breaks // empty')

if [ -n "$breaks" ] && grep \
  --exclude-dir=.git \
  --fixed-strings \
  --quiet \
  --recursive \
  -- "$breaks" .
then
  exit 1
fi

printf '%s' "$answer" | jq --join-output '.stdout // empty'
exit "$(printf '%s' "$answer" | jq '.status // 0')"
