import { join } from 'node:path'

import { vi } from 'vitest'

import type { Run } from '../../.mise/audit/audit.ts'

/**
 * A task as a case declares it, its `source` relative to the checkout.
 */
interface Declared {
  name     : string
  source   : string
  depends? : string[]
  file?    : boolean
  run?     : (string | { tasks: string[] })[]
  tools?   : Record<string, string>
}

const PACKAGES = ['.', 'site', 'tests/homebridge', 'tests/vet/floor', 'tests/vet/pinned']

/**
 * Lists `tasks` as `mise tasks ls --json` prints them for the checkout at
 * `root`, where `file` marks a task whose script is its own file.
 */
export const listing = (root: string, tasks: Declared[]): object[] =>
  tasks.map(({ depends = [], file = false, name, run = [], source, tools = {} }) => ({
    depends : depends,
    file    : file ? join(root, source) : null,
    name    : name,
    run     : run,
    source  : join(root, source),
    tools   : tools
  }))

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
