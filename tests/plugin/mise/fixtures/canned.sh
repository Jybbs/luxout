#!/bin/sh
program=$(basename "$0")

reply=$(
  jq \
    --arg cwd "$PWD" \
    --arg key "$program $*" \
    --argjson canned "${CANNED:-null}" \
    --null-input \
    --raw-output \
    '
      $canned[$key] as $answer
      | "entry=\({ args: $ARGS.positional, cwd: $cwd } | tojson | @sh)",
        if $answer == null then "canned=false" else
          "breaks=\($answer.breaks // "" | @sh)",
          "canned=true",
          "status=\($answer.status // 0)",
          "stdout=\($answer.stdout // "" | @sh)"
        end
    ' \
    --args -- "$program" "$@"
) || exit

eval "$reply"
printf '%s\n' "$entry" >> "$CANNED_LOG"

if [ "$canned" = false ]; then
  PATH=${PATH#*:}
  exec "$program" "$@"
fi

if [ -n "$breaks" ] && grep \
  --exclude-dir=.git \
  --fixed-strings \
  --quiet \
  --recursive \
  -- "$breaks" .
then
  exit 1
fi

printf '%s' "$stdout"
exit "$status"
