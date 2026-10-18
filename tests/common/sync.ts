import { type SpawnSyncReturns, execFileSync, spawnSync } from 'node:child_process'
import { cp, mkdir, readFile }                           from 'node:fs/promises'
import { delimiter, join }                               from 'node:path'

import { plant } from './scratch.js'

/**
 * The reply a canned stand-in gives one call, which exits 1 instead wherever a
 * file under the directory the call runs in holds `breaks`.
 */
export interface Answer {
  breaks? : string
  status? : number
  stdout? : string
}

/**
 * A call the stand-in `gh` received, beside the JSON body its `--input` named.
 */
export interface Call {
  args : string[]
  body : unknown
}

export interface SyncRun extends Pick<SpawnSyncReturns<string>, 'status' | 'stderr' | 'stdout'> {
  calls   : Call[]
  invoked : Invocation[]
}

/**
 * A call a canned stand-in received, beside the directory it ran in.
 */
interface Invocation {
  args : string[]
  cwd  : string
}

interface SyncSetup {
  args?   : string[]
  canned? : Record<string, Answer>
  env?    : NodeJS.ProcessEnv
  fail?   : string
  live?   : Record<string, unknown>
}

const fixtures = join(import.meta.dirname, '..', 'mise', 'fixtures')
const root     = join(import.meta.dirname, '..', '..')
const path     = execFileSync('mise', ['x', '--', 'printenv', 'PATH'], { cwd: root, encoding: 'utf8' }).trim()

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
 * Runs `task` with `args` in `scratch` under stand-ins for the programs it
 * calls, beside the variables `env` adds to the task's environment.
 *
 * A stand-in `gh` answers a call to each endpoint `live` keys with that key's
 * value, read as pages where the call paginates, and fails each call naming
 * `fail`. A canned stand-in takes the place of each program that opens a
 * `canned` key, answering each call a key names with that key's `Answer` and
 * passing any other call on to the program further along the path. The run
 * points mise's directories and the temporary directory under `scratch`.
 */
export async function sync(
  scratch                                               : string,
  task                                                  : string,
  { args = [], canned = {}, env = {}, fail, live = {} } : SyncSetup = {}
): Promise<SyncRun> {
  const programs = new Set(Object.keys(canned).map((call) => call.replace(/ .*/, '')))

  await plant(scratch, { 'canned.log': '', 'gh.log': '' })
  await mkdir(join(scratch, 'tmp'), { recursive: true })
  await Promise.all([
    cp(join(fixtures, 'gh.sh'), join(scratch, 'bin', 'gh')),
    ...[...programs].map((program) => cp(join(fixtures, 'canned.sh'), join(scratch, 'bin', program)))
  ])

  const { status, stderr, stdout } = spawnSync(join(root, source(task)), args, {
    cwd      : scratch,
    encoding : 'utf8',
    env      : {
      ...env,
      CANNED            : JSON.stringify(canned),
      CANNED_LOG        : join(scratch, 'canned.log'),
      GH_CONFIG_DIR     : scratch,
      GH_FAIL           : fail ?? '',
      GH_LIVE           : JSON.stringify(live),
      GH_LOG            : join(scratch, 'gh.log'),
      MISE_CACHE_DIR    : join(scratch, 'tmp', 'mise', 'cache'),
      MISE_DATA_DIR     : join(scratch, 'tmp', 'mise', 'data'),
      MISE_PROJECT_ROOT : root,
      MISE_STATE_DIR    : join(scratch, 'tmp', 'mise', 'state'),
      PATH              : join(scratch, 'bin') + delimiter + path,
      TMPDIR            : join(scratch, 'tmp')
    }
  })

  const lines = async (log: string): Promise<string[]> =>
    (await readFile(join(scratch, log), 'utf8')).split('\n').slice(0, -1)

  return {
    calls   : (await lines('gh.log')).map((line): Call => JSON.parse(line)),
    invoked : (await lines('canned.log')).map((line): Invocation => JSON.parse(line)),
    status  : status,
    stderr  : stderr,
    stdout  : stdout
  }
}
