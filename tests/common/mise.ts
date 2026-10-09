import { vi } from 'vitest'

import type { Run } from '../../.mise/audit/audit.ts'

export const mise = (listed: object[], issues: object[] = []): Run =>
  vi.fn<Run>((_, [, verb]) => ({ stderr: '', stdout: JSON.stringify(verb === 'ls' ? listed : { issues }) }))
