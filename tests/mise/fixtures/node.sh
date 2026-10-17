#!/bin/sh
[ -n "$NODE_VERSION" ] || exit 127
printf '%s\n' "$NODE_VERSION"
