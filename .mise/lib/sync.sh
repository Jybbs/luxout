list_omitted() {
  local declared=$1 noun=$2 path=$3
  local omitted

  omitted=$(
    gh api --jq '.[].name' --paginate "$path" \
      | jq \
          --argjson declared "$declared" \
          --raw-input \
          --raw-output \
          'select(IN($declared[]) | not) | "  " + .'
  ) || return

  [[ -n "$omitted" ]] || return 0

  printf 'GitHub holds %s no file declares, left in place:\n%s\n' "$noun" "$omitted"
}
