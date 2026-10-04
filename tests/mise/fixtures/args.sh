#!/bin/sh
printf '%s\0' "$(basename "$0")" "$@"
