/** @module-tag spawns */
import { cp, readFile } from 'node:fs/promises'
import { join }         from 'node:path'

import { describe } from 'vitest'

import { PACKAGES, VET }                   from '../../../common/mise.js'
import { plant, test }                     from '../../../common/scratch.js'
import { type Answer, type SyncRun, sync } from '../../../common/sync.js'

interface Drift {
  config? : (text: string) => string
  lines?  : (text: string) => string
  lock?   : (text: string) => string
}

const BUN      = PACKAGES.map((dir) => ['bun', 'install', '--cwd', dir, '--dry-run', '--frozen-lockfile'])
const CHECK    = ['mise', 'lock', '--check']
const DRY      = ['mise', 'lock', '--dry-run', '--json']
const LINE     = /^tools\s*=\s*\{ node = "(?<release>[^"]+)" \}\n/gm
const PIN      = (tool: string): RegExp => new RegExp(`^${tool}\\s*=\\s*"(?<release>[^"]+)"\\n`, 'm')
const PLATFORM = /^\[tools\.watchexec\."platforms\.linux-x64"\]\n(?:.+\n)+\n/m
const root     = join(import.meta.dirname, '..', '..', '..', '..')

const read    = (file: string): Promise<string> => readFile(join(root, '.mise', file), 'utf8')
const release = (text: string, pin: RegExp): string | undefined => pin.exec(text)?.groups?.release

const [CONFIG, LINES] = await Promise.all([read('config.toml'), read('tasks/plugin/lines.toml')])

/**
 * Runs the task over scratch copies of `.mise/config.toml`, `.mise/mise.lock`,
 * and `.mise/tasks/`, the last so the dry run counts each tool a task declares,
 * where `config`, `lock`, and `lines` edit the config, the lockfile, and
 * `.mise/tasks/plugin/lines.toml`. The real `mise lock --check` reads the
 * copies offline, and the real `mise lock --dry-run --json` runs offline unless
 * a stand-in answers it with `dry`.
 *
 * Returns:
 *   The run, whose `commands` hold each call the stand-ins received, in order.
 */
async function check(
  scratch : string,
  { config = String, lines = String, lock = String } : Drift,
  dry     : Answer | null = null
): Promise<SyncRun> {
  await cp(join(root, '.mise', 'tasks'), join(scratch, '.mise', 'tasks'), { recursive: true })
  await plant(scratch, {
    ...VET,
    '.mise/config.toml'             : config(CONFIG),
    '.mise/mise.lock'               : lock(await read('mise.lock')),
    '.mise/tasks/plugin/lines.toml' : lines(LINES)
  })

  return sync(scratch, 'lock:check', {
    canned : { ...Object.fromEntries(BUN.map((call) => [call.join(' '), {}])), [DRY.join(' ')]: dry },
    env    : {
      MISE_CONFIG_DIR           : join(scratch, 'tmp', 'mise', 'config'),
      MISE_OFFLINE              : '1',
      MISE_QUIET                : '1',
      MISE_TRUSTED_CONFIG_PATHS : scratch
    }
  })
}

describe.concurrent('lock:check', () => {
  test('passes where each lockfile matches its manifest and the dry run drops no version', async ({
    expect,
    scratch
  }) => {
    expect(await check(scratch, {})).toMatchObject({ commands: [...BUN, CHECK, DRY], status: 0 })
  })

  test('passes where the dry run adds a version and drops none', async ({ expect, scratch }) => {
    const added = [{ name: 'node', new_versions: ['26.13.1', '26.13.2'], old_versions: ['26.13.1'] }]

    expect(await check(scratch, {}, { stdout: JSON.stringify(added) })).toMatchObject({
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

  test.for([
    {
      drift : { config: (text: string) => text.replace(PIN('watchexec'), '').replace(PIN('zizmor'), '') },
      dry   : null,
      kind  : 'each version of a tool the config no longer declares',
      stale : ['watchexec', 'zizmor'].map((tool) => `${tool}@${release(CONFIG, PIN(tool))}`)
    },
    {
      drift : { lines: (text: string) => text.replaceAll(LINE, '') },
      dry   : null,
      kind  : 'each version left once the tasks drop their tools tables',
      stale : [...LINES.matchAll(LINE)].map(({ groups }) => `node@${groups?.release}`)
    },
    {
      drift : {},
      kind  : 'a version the dry run replaces with another',
      stale : ['node@26.13.1'],
      dry   : {
        stdout: JSON.stringify([{ name: 'node', new_versions: ['26.13.2'], old_versions: ['26.13.1'] }])
      }
    }
  ])('fails naming $kind', async ({ drift, dry, stale }, { expect, scratch }) => {
    expect(await check(scratch, drift, dry)).toMatchObject({
      commands : [...BUN, CHECK, DRY],
      status   : 1,
      stderr   : `.mise/mise.lock locks ${stale.join(', ')}, which nothing in .mise/ declares any `
               + 'longer, so run `mise run relock`\n'
    })
  })

  test('fails where the dry run exits nonzero', async ({ expect, scratch }) => {
    expect(await check(scratch, {}, { status: 1 })).toMatchObject({
      commands : [...BUN, CHECK, DRY],
      status   : 1
    })
  })
})
