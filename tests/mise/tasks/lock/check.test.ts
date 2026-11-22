/** @module-tag spawns */
import { readFile } from 'node:fs/promises'
import { join }     from 'node:path'

import { describe } from 'vitest'

import { PACKAGES, VET }                   from '../../../common/mise.js'
import { plant, test }                     from '../../../common/scratch.js'
import { type Answer, type SyncRun, sync } from '../../../common/sync.js'

interface Drift {
  config? : (text: string) => string
  lock?   : (text: string) => string
}

const BUN      = PACKAGES.map((dir) => ['bun', 'install', '--cwd', dir, '--dry-run', '--frozen-lockfile'])
const CHECK    = ['mise', 'lock', '--check']
const DRY      = ['mise', 'lock', '--dry-run', '--json']
const PIN      = (tool: string): RegExp => new RegExp(`^${tool}\\s*=\\s*"[^"]+"\\n`, 'm')
const PLATFORM = /^\[tools\.watchexec\."platforms\.linux-x64"\]\n(?:.+\n)+\n/m
const root     = join(import.meta.dirname, '..', '..', '..', '..')

/**
 * Runs the task over scratch copies of `.mise/config.toml` and
 * `.mise/mise.lock` once `drift` edits them, where the real `mise lock --check`
 * reads both copies offline and a stand-in answers `mise lock --dry-run --json`
 * with `dry`.
 *
 * Returns:
 *   The run, whose `commands` hold each call the stand-ins received, in order.
 */
async function check(
  scratch                            : string,
  { config = String, lock = String } : Drift,
  dry                                : Answer = { stdout: '[]' }
): Promise<SyncRun> {
  const read = (file: string): Promise<string> => readFile(join(root, '.mise', file), 'utf8')

  await plant(scratch, {
    ...VET,
    '.mise/config.toml' : config(await read('config.toml')),
    '.mise/mise.lock'   : lock(await read('mise.lock'))
  })

  return sync(scratch, 'lock:check', {
    canned : { ...Object.fromEntries(BUN.map((call) => [call.join(' '), {}])), [DRY.join(' ')]: dry },
    env    : { MISE_CONFIG_DIR: join(scratch, 'tmp', 'mise', 'config'), MISE_TRUSTED_CONFIG_PATHS: scratch }
  })
}

describe.concurrent('lock:check', () => {
  test('passes where each lockfile matches its manifest and the dry run drops no tool', async ({
    expect,
    scratch
  }) => {
    expect(await check(scratch, {})).toMatchObject({ commands: [...BUN, CHECK, DRY], status: 0 })
  })

  test('passes where the dry run lists a tool only for a new version', async ({ expect, scratch }) => {
    const bumped = [{ name: 'node', new_versions: ['26.13.2'], old_versions: ['26.13.1'] }]

    expect(await check(scratch, {}, { stdout: JSON.stringify(bumped) })).toMatchObject({
      commands : [...BUN, CHECK, DRY],
      status   : 0
    })
  })

  test.for([
    {
      drift  : { config: (text: string) => text.replace(PIN('watchexec'), 'watchexec = "0.0.1"\n') },
      kind   : 'a pin in .mise/config.toml changed with no lockfile change',
      reason : 'watchexec@0.0.1 is not in the lockfile'
    },
    {
      drift  : { lock: (text: string) => text.replace(PLATFORM, '') },
      kind   : 'a platform entry removed from .mise/mise.lock',
      reason : 'No lockfile URL found for watchexec@'
    }
  ])('fails through mise lock --check on $kind', async ({ drift, reason }, { expect, scratch }) => {
    expect(await check(scratch, drift)).toMatchObject({
      commands : [...BUN, CHECK],
      status   : 1,
      stderr   : expect.stringContaining(reason)
    })
  })

  test('fails naming each tool the lockfile keeps once the config no longer declares it', async ({
    expect,
    scratch
  }) => {
    const stale = [
      { name: 'watchexec', new_versions: [], old_versions: ['2.8.0'] },
      { name: 'zizmor', new_versions: [], old_versions: ['1.32.0'] }
    ]
    const drift = { config: (text: string) => text.replace(PIN('watchexec'), '').replace(PIN('zizmor'), '') }

    expect(await check(scratch, drift, { stdout: JSON.stringify(stale) })).toMatchObject({
      commands : [...BUN, CHECK, DRY],
      status   : 1,
      stderr   : '.mise/mise.lock locks watchexec, zizmor, which .mise/config.toml no longer declares,'
               + ' so run `mise relock`\n'
    })
  })

  test('fails where the dry run exits nonzero', async ({ expect, scratch }) => {
    expect(await check(scratch, {}, { status: 1 })).toMatchObject({
      commands : [...BUN, CHECK, DRY],
      status   : 1
    })
  })
})
