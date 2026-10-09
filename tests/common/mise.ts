import { vi } from 'vitest'

import type { Run } from '../../.mise/audit/audit.ts'

/**
 * Stands in for mise, listing `listed` through `mise tasks ls` and reporting
 * `issues` through `mise tasks validate`.
 */
export const mise = (listed: object[], issues: object[] = []): Run =>
  vi.fn<Run>((_, [, verb]) => ({ stderr: '', stdout: JSON.stringify(verb === 'ls' ? listed : { issues }) }))
