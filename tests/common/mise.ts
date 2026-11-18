import { vi } from 'vitest'

import type { Run } from '../../.mise/audit/audit.ts'

const PACKAGES = ['.', 'site', 'tests/homebridge', 'tests/vet/floor', 'tests/vet/pinned']

/**
 * Stands in for the commands an audit runs, answering `mise tasks ls` with
 * `listed`, any other mise call with `issues`, `git ls-files` with `tracked`,
 * and `bun_packages` with one directory per row of `packages`.
 */
export const mise = (listed: object[], issues: object[] = [], tracked = '', packages = PACKAGES): Run =>
  vi.fn<Run>((command, [, verb]) => ({
    stderr : '',
    stdout : {
      bash : packages.map((dir) => `${dir}\n`).join(''),
      git  : tracked,
      mise : JSON.stringify(verb === 'ls' ? listed : { issues })
    }[command] ?? ''
  }))
