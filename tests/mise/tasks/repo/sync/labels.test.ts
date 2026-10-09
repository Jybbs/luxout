import { execFileSync, spawnSync } from 'node:child_process'
import { cp, readFile }            from 'node:fs/promises'
import { delimiter, join }         from 'node:path'

import { expect } from 'vitest'

import { plant, test } from '../../../../common/scratch.js'

const LISTING = ['api', '--jq', '.[].name', '--paginate', 'repos/{owner}/{repo}/labels']

const REGISTRY = [
  '["🐞 bug"]',
  'color       = "c62d42"',
  'description = "A defect, filed beside the label of the domain where it breaks"',
  '',
  String.raw`["🧪 it's \"odd\""]`,
  'color       = "8cc5a3"',
  String.raw`description = "-Quotes ' and \" and $HOME and \\ stay as written"`
].join('\n')

const ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..')
const PATH = execFileSync('mise', ['x', '--', 'printenv', 'PATH'], { cwd: ROOT, encoding: 'utf8' }).trim()
const TASK = join(ROOT, '.mise', 'tasks', 'repo', 'sync', 'labels')

/**
 * Runs the task in `scratch` against `registry`, with a stand-in `gh` first on
 * its path that logs each call, answers `gh api` with the names in `live`, and
 * fails each call to the `gh` command `fail` names.
 */
async function sync(
  registry            : string,
  scratch             : string,
  { fail, live = [] } : { fail?: 'api' | 'label', live?: string[] } = {}
): Promise<{ calls: string[][], status: number | null, stdout: string }> {
  await plant(scratch, { '.github/labels.toml': registry, 'gh.log': '' })
  await cp(join(import.meta.dirname, '..', '..', '..', 'fixtures', 'gh.sh'), join(scratch, 'bin', 'gh'))

  const { status, stdout } = spawnSync(TASK, [], {
    cwd      : scratch,
    encoding : 'utf8',
    env      : {
      GH_CONFIG_DIR     : scratch,
      GH_FAIL           : fail ?? '',
      GH_LIVE           : live.join('\n'),
      GH_LOG            : join(scratch, 'gh.log'),
      MISE_PROJECT_ROOT : ROOT,
      PATH              : join(scratch, 'bin') + delimiter + PATH
    }
  })

  const log   = await readFile(join(scratch, 'gh.log'), 'utf8')
  const calls = log.split('\n').slice(0, -1).map((call) => call.split('\0').slice(0, -1))

  return { calls, status, stdout }
}

test('creates or updates each declared label with every value as written', async ({ scratch }) => {
  expect(await sync(REGISTRY, scratch, { live: ['🐞 bug', '🧪 it\'s "odd"'] })).toEqual({
    status : 0,
    stdout : '',
    calls  : [
      [
        'label', 'create', '--color', 'c62d42', '--description',
        'A defect, filed beside the label of the domain where it breaks', '--force', '🐞 bug'
      ],
      [
        'label', 'create', '--color', '8cc5a3', '--description',
        '-Quotes \' and " and $HOME and \\ stay as written', '--force', '🧪 it\'s "odd"'
      ],
      LISTING
    ]
  })
})

test('lists each live label the registry omits rather than deleting it', async ({ scratch }) => {
  const { calls, status, stdout } = await sync(REGISTRY, scratch, {
    live: ['🔦 discovery', '🐞 bug', 'wontfix']
  })

  expect({ commands: calls.map((call) => call.slice(0, 2)), status, stdout }).toEqual({
    commands : [['label', 'create'], ['label', 'create'], LISTING.slice(0, 2)],
    status   : 0,
    stdout   : 'GitHub holds labels no file declares, left in place:\n  🔦 discovery\n  wontfix\n'
  })
})

test('creates nothing where the registry declares no label', async ({ scratch }) => {
  expect(await sync('', scratch)).toEqual({ calls: [LISTING], status: 0, stdout: '' })
})

test('writes nothing where the registry fails to parse', async ({ scratch }) => {
  expect(await sync('["🐞 bug"]\ncolor = [\n', scratch)).toMatchObject({ calls: [], status: 1 })
})

test('stops before listing the live labels where a create fails', async ({ scratch }) => {
  const { calls, status } = await sync(REGISTRY, scratch, { fail: 'label' })

  expect({ commands: calls.map(([command]) => command), failed: status !== 0 })
    .toEqual({ commands: ['label', 'label'], failed: true })
})

test('fails without listing where reading the live labels fails', async ({ scratch }) => {
  expect(await sync(REGISTRY, scratch, { fail: 'api' })).toMatchObject({ status: 1, stdout: '' })
})

test('asks before writing when run as labels, failing with no terminal to answer', async ({ scratch }) => {
  const task = join(scratch, '.mise', 'tasks', 'repo', 'sync', 'labels')

  await plant(scratch, { '.mise/config.toml': '' })
  await cp(TASK, task)

  const { status, stderr } = spawnSync('mise', ['run', 'labels'], {
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

  expect({ asked: stderr.includes('requires confirmation'), status }).toEqual({ asked: true, status: 1 })
}, 30_000)
