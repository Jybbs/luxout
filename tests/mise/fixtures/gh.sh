#!/bin/sh
{ printf '%s\0' "$@"; echo; } >> "$GH_LOG"

case "$1" in
  api)   [ -z "$GH_LIVE" ] || printf '%s\n' "$GH_LIVE" ;;
  label) [ -z "$GH_FAIL" ] ;;
esac
