#!/bin/sh
case "$1" in
  run)
    file=$MISE_PROJECT_ROOT/.mise/tasks/$(echo "$2" | tr : /)
    task=$2
    shift 3
    MISE_TASK_NAME=$task exec "$file" "$@"
    ;;
  tasks) echo '{}' ;;
  *)     exit 127 ;;
esac
