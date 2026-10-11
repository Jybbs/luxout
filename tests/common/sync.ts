import { type SpawnSyncReturns, execFileSync, spawnSync } from 'node:child_process'
import { cp, readFile }                                  from 'node:fs/promises'
import { delimiter, join }                               from 'node:path'

import { plant } from './scratch.js'

/**
 * A call the stand-in `gh` received, beside the JSON body its `--input` named.
 */
export interface Call {
  args : string[]
  body : unknown
}

export interface SyncRun extends Pick<SpawnSyncReturns<string>, 'status' | 'stderr' | 'stdout'> {
  calls: Call[]
}

const root = join(import.meta.dirname, '..', '..')
const path = execFileSync('mise', ['x', '--', 'printenv', 'PATH'], { cwd: root, encoding: 'utf8' }).trim()

const source = (task: string): string => join('.mise', 'tasks', ...task.split(':'))

/**
 * Runs `task` through mise as `alias` from `scratch`, a checkout holding only
 * the task, where no terminal answers the prompt it opens on.
 */
export async function confirm(
  alias   : string,
  scratch : string,
  task    : string
): Promise<{ asked: boolean, status: number | null }> {
  await plant(scratch, { '.mise/config.toml': '' })
  await cp(join(root, source(task)), join(scratch, source(task)))

  const { status, stderr } = spawnSync('mise', ['run', alias], {
    cwd      : scratch,
    encoding : 'utf8',
    stdio    : ['ignore', 'pipe', 'pipe'],
    env      : {
      GH_CONFIG_DIR             : scratch,
      HOME                      : process.env.HOME,
      MISE_TRUSTED_CONFIG_PATHS : scratch,
      PATH                      : process.env.PATH
    }
  })

  return { asked: stderr.includes('requires confirmation'), status }
}

/**
 * Runs `task` in `scratch` with a stand-in `gh`, which answers a call to each
 * endpoint `live` keys with that key's value, read as pages where the call
 * paginates, and fails each call naming `fail`.
 */
export async function sync(
  scratch             : string,
  task                : string,
  { fail, live = {} } : { fail?: string, live?: Record<string, unknown> } = {}
): Promise<SyncRun> {
  await plant(scratch, { 'gh.log': '' })
  await cp(join(import.meta.dirname, '..', 'mise', 'fixtures', 'gh.sh'), join(scratch, 'bin', 'gh'))

  const { status, stderr, stdout } = spawnSync(join(root, source(task)), [], {
    cwd      : scratch,
    encoding : 'utf8',
    env      : {
      GH_CONFIG_DIR     : scratch,
      GH_FAIL           : fail ?? '',
      GH_LIVE           : JSON.stringify(live),
      GH_LOG            : join(scratch, 'gh.log'),
      MISE_PROJECT_ROOT : root,
      PATH              : join(scratch, 'bin') + delimiter + path
    }
  })

  const log = await readFile(join(scratch, 'gh.log'), 'utf8')

  return { calls: log.split('\n').slice(0, -1).map((call) => JSON.parse(call)), status, stderr, stdout }
}
