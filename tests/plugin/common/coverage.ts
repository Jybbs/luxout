type Metric = 'branches' | 'functions' | 'lines' | 'statements'

/**
 * Reads the share `COVERAGE_FLOOR` sets in `.mise/config.toml` as the floor of
 * every metric Vitest's coverage thresholds take, throwing where the variable
 * is unset or holds no number.
 *
 * Args:
 *   floor: The variable's value, unset where the environment lacks it.
 */
export function thresholds(floor = process.env.COVERAGE_FLOOR): Record<Metric, number> {
  const share = Number(floor)

  if (!floor?.trim() || !Number.isFinite(share)) {
    throw new Error(`COVERAGE_FLOOR holds ${floor === undefined ? 'nothing' : `"${floor}"`}, whereas the `
                  + 'coverage floor of both suites needs a number, so run the suite through mise')
  }

  return { branches: share, functions: share, lines: share, statements: share }
}
