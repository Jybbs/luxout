bun_packages() {
  printf '%s\n' . site tests/vet/*
}

lifted_packages() {
  bun_packages | grep --fixed-strings --invert-match --line-regexp tests/vet/floor
}
