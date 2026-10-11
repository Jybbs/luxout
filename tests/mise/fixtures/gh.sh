#!/bin/sh
{ printf '%s\0' "$@"; echo; } >> "$GH_LOG"

[ "$1" != "$GH_FAIL" ] || exit 1
[ "$1" != api ] || [ -z "$GH_LIVE" ] || printf '%s\n' "$GH_LIVE"
