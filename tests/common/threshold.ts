import { expect } from 'vitest'

import { ThresholdEntry } from '../../src/config/threshold.js'

/**
 * Parses `raw` as the first entry under `thresholds`, failing the case with the
 * line its fault logs where it fails.
 */
export function thresholdEntry(raw: object): ThresholdEntry {
  const parsed = ThresholdEntry.parse(raw, 0)

  return parsed instanceof ThresholdEntry ? parsed : expect.unreachable(parsed.line)
}
