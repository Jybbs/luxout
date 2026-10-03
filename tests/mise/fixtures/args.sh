#!/bin/sh
for arg in "$@"; do printf '%s\0' "$arg"; done
