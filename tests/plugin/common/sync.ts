import { type ExecFileException, execFile, execFileSync } from 'node:child_process'
import { cp, mkdir, readFile }                           from 'node:fs/promises'
import { delimiter, join }                               from 'node:path'
import { promisify }                                     from 'node:util'

import { plant } from './scratch.js'
import { root }  from './paths.js'

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

/**
 * A call a canned stand-in received, beside the directory it ran in.
 */
interface Invocation {
  args : string[]
  cwd  : string
}

/**
 * The exit status and output of a program `spawned` ran.
 */
interface Spawned {
  status : number | null
  stderr : string
  stdout : string
}

/**
 * The run of a task under stand-ins, beside the calls the stand-ins received:
 *
 * - `calls`, each call the stand-in `gh` received
 * - `commands`, the arguments of each call a canned stand-in received
 * - `invoked`, each of those calls beside the directory it ran in
 * - `requests`, the arguments of each call the stand-in `gh` received
 */
export interface SyncRun extends Spawned {
  calls    : Call[]
  commands : string[][]
  invoked  : Invocation[]
  requests : string[][]
}

interface SyncSetup {
  args?   : string[]
  canned? : Record<string, Answer | null>
  cwd?    : string
  env?    : NodeJS.ProcessEnv
  fail?   : string
  live?   : Record<string, unknown>
}

const exec     = promisify(execFile)
const fixtures = join(import.meta.dirname, '..', 'mise', 'fixtures')
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

  const { status, stderr } = await spawned('mise', ['run', alias], {
    cwd : scratch,
    env : {
      GH_CONFIG_DIR             : scratch,
      HOME                      : process.env.HOME,
      MISE_TRUSTED_CONFIG_PATHS : scratch,
      PATH                      : process.env.PATH
    }
  })

  return { asked: stderr.includes('requires confirmation'), status }
}

/**
 * Reads what `mise tasks info` reports of `task` in the repository the suite
 * runs in.
 */
export async function info(task: string): Promise<unknown> {
  const { stdout } = await spawned('mise', ['tasks', 'info', '--json', task], { cwd: root, env: process.env })

  return JSON.parse(stdout)
}

/**
 * Runs `mise` with `args` in `scratch`, a checkout mise trusts, under the
 * suite's environment beside the variables `env` adds, with mise's config and
 * state directories under `scratch`, so no global config or task history
 * reaches the run.
 */
export function mised(scratch: string, args: string[], env: NodeJS.ProcessEnv = {}): Promise<Spawned> {
  return spawned('mise', args, {
    cwd : scratch,
    env : {
      ...process.env,
      ...env,
      MISE_CONFIG_DIR           : join(scratch, 'tmp', 'mise', 'config'),
      MISE_STATE_DIR            : join(scratch, 'tmp', 'mise', 'state'),
      MISE_TRUSTED_CONFIG_PATHS : scratch
    }
  })
}

/**
 * Runs `file` with `args` through the promisified `execFile`, its standard
 * input closed, and resolves to its exit status and output whatever status it
 * exits with.
 */
export async function spawned(
  file    : string,
  args    : string[],
  options : { cwd: string, env: NodeJS.ProcessEnv }
): Promise<Spawned> {
  const child = exec(file, args, { ...options, encoding: 'utf8', maxBuffer: Infinity })

  child.child.stdin?.end()

  return child.then(
    ({ stderr, stdout }) => ({ status: 0, stderr, stdout }),
    ({ code, stderr, stdout }: ExecFileException) => ({
      status : typeof code === 'number' ? code : null,
      stderr : stderr ?? '',
      stdout : stdout ?? ''
    })
  )
}

/**
 * Runs `task` with `args` in `cwd`, which defaults to `scratch`, under
 * stand-ins for the programs it calls, beside the variables `env` adds to the
 * task's environment.
 *
 * A stand-in `gh` answers a call to each endpoint `live` keys with that key's
 * value, read as pages where the call paginates, and fails each call naming
 * `fail`. A canned stand-in takes the place of each program that opens a
 * `canned` key, answering each call a key names with that key's `Answer` and
 * passing any other call, or one whose key holds `null`, on to the program
 * further along the path, logging each call either way. The run points mise's
 * directories and the temporary directory under `scratch`.
 */
export async function sync(
  scratch : string,
  task    : string,
  { args = [], canned = {}, cwd = scratch, env = {}, fail, live = {} } : SyncSetup = {}
): Promise<SyncRun> {
  const programs = new Set(Object.keys(canned).map((call) => call.replace(/ .*/, '')))

  await plant(scratch, { 'canned.log': '', 'gh.log': '' })
  await mkdir(join(scratch, 'tmp'), { recursive: true })
  await Promise.all([
    cp(join(fixtures, 'gh.sh'), join(scratch, 'bin', 'gh')),
    ...[...programs].map((program) => cp(join(fixtures, 'canned.sh'), join(scratch, 'bin', program)))
  ])

  const { status, stderr, stdout } = await spawned(join(root, source(task)), args, {
    cwd : cwd,
    env : {
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

  const calls   = (await lines('gh.log')).map((line): Call => JSON.parse(line))
  const invoked = (await lines('canned.log')).map((line): Invocation => JSON.parse(line))

  return {
    calls    : calls,
    commands : invoked.map(({ args }) => args),
    invoked  : invoked,
    requests : calls.map(({ args }) => args),
    status   : status,
    stderr   : stderr,
    stdout   : stdout
  }
}
