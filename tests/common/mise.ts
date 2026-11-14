import { vi } from 'vitest'

import type { Run } from '../../.mise/audit/audit.ts'

export const mise = (listed: object[], issues: object[] = [], tracked = ''): Run =>
  vi.fn<Run>((command, [, verb]) => ({
    stderr : '',
    stdout : command === 'git' ? tracked : JSON.stringify(verb === 'ls' ? listed : { issues })
  }))
