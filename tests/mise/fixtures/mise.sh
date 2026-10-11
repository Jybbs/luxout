#!/bin/sh
[ -n "$MISE_TASK_INFO" ] && [ "$*" = "tasks info --json $MISE_TASK_NAME" ] || exit 1
printf '%s\n' "$MISE_TASK_INFO"
