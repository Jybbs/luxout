bun_packages() {
  printf '%s\n' . site tests/homebridge tests/vet/*
}

install_seed() {
  local seed=$1 target=$2

  mkdir -p "$target"
  cp "$seed"/{bun.lock,bunfig.toml,package.json} "$target"
  bun install --cwd "$target" --frozen-lockfile
}

lifted_packages() {
  bun_packages | grep --fixed-strings --invert-match --line-regexp tests/vet/floor
}
