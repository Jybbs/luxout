#!/bin/sh
printf '%s\0' "$(cd "$(dirname "$0")" && pwd -P)/$(basename "$0")" "$@"
