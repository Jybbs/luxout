import { join } from 'node:path'

import { vi } from 'vitest'

import type { Run } from '../../../.mise/audit/audit.ts'

/**
 * A task as a case declares it, its `source` relative to the checkout.
 */
interface Declared {
  name     : string
  source   : string
  aliases? : string[]
  depends? : string[]
  file?    : boolean | string
  run?     : (string | { tasks: string[] })[]
  tools?   : Record<string, string>
}

/**
 * The `Commands:` section of `mise --help` and the sections around it, wrapped
 * at the width mise prints to a pipe, with an alias list and a description
 * each running onto a second line.
 */
export const HELP = [
  'mise installs the development tools your projects need.',
  '',
  'Commands:',
  '  activate      Print the script to activate mise in an',
  '                interactive shell',
  '  audit         Check tool versions for known vulnerabilities',
  '  backends      Manage backends [aliases: b, backend,',
  '                backend-list]',
  '  run           Run tasks and their dependencies [aliases: r]',
  '',
  'Arguments:',
  '  [TASK]  Task to run',
  ''
].join('\n')

/**
 * The directories `bun_packages` in `.mise/lib/lock.sh` lists, one per Bun
 * package.
 */
export const PACKAGES = ['.', 'tests/plugin/homebridge', 'tests/plugin/vet/floor', 'tests/plugin/vet/pinned']

/**
 * An empty manifest in each directory under `tests/plugin/vet/`, so the glob in
 * `bun_packages` lists those directories in a scratch checkout.
 */
export const VET = {
  'tests/plugin/vet/floor/package.json'  : '{}\n',
  'tests/plugin/vet/pinned/package.json' : '{}\n'
}

/**
 * Lists `tasks` as `mise tasks ls --json` prints them for the checkout at
 * `root`, where `file` marks a task whose script is its own file or names the
 * script a TOML task runs, relative to the checkout.
 */
export const listing = (root: string, tasks: Declared[]): object[] =>
  tasks.map(({ aliases = [], depends = [], file = false, name, run = [], source, tools = {} }) => ({
    aliases : aliases,
    depends : depends,
    file    : file === false ? null : join(root, file === true ? source : file),
    name    : name,
    run     : run,
    source  : join(root, source),
    tools   : tools
  }))

/**
 * Stands in for the commands an audit runs, answering `mise tasks ls` with
 * `listed`, `mise tasks validate` with `issues`, `mise --help` with `help`,
 * `git ls-files` with `tracked`, and `bun_packages` with one directory per row
 * of `packages`, and printing nothing for any other mise call.
 */
export const mise = (
  listed   : object[],
  issues   : object[] = [],
  tracked  : string   = '',
  packages : string[] = PACKAGES,
  help     : string   = HELP
): Run =>
  vi.fn<Run>((command, [first, verb]) => ({
    stderr : '',
    stdout : {
      bash : packages.map((dir) => `${dir}\n`).join(''),
      git  : tracked,
      mise : first === '--help' ? help : {
        ls       : JSON.stringify(listed),
        validate : JSON.stringify({ issues })
      }[verb ?? ''] ?? ''
    }[command] ?? ''
  }))
