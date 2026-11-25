bun_packages() {
  printf '%s\n' . tests/plugin/homebridge tests/plugin/vet/*
}

install_seed() {
  local seed=$1 target=$2

  mkdir -p "$target"
  cp "$seed"/{bun.lock,package.json} "$target"
  bun install --cwd "$target" --frozen-lockfile
}

lifted_packages() {
  bun_packages | grep --fixed-strings --invert-match --line-regexp tests/plugin/vet/floor
}
