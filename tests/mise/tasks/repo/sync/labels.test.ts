import { spawnSync } from 'node:child_process'
import { cp }        from 'node:fs/promises'
import { join }      from 'node:path'

import { expect } from 'vitest'

import { logged, standIn } from '../../../../common/gh.js'
import { plant, test }     from '../../../../common/scratch.js'

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

const root = join(import.meta.dirname, '..', '..', '..', '..', '..')
const task = join(root, '.mise', 'tasks', 'repo', 'sync', 'labels')

/**
 * Runs the task in `scratch` with a stand-in `gh` that answers `gh api` with
 * `live` and fails each call to the command `fail` names.
 */
async function sync(
  registry            : string,
  scratch             : string,
  { fail, live = [] } : { fail?: 'api' | 'label', live?: string[] } = {}
) {
  await plant(scratch, { '.github/labels.toml': registry })

  const { status, stdout } = spawnSync(task, [], {
    cwd      : scratch,
    encoding : 'utf8',
    env      : {
      ...await standIn(scratch),
      GH_CONFIG_DIR     : scratch,
      GH_FAIL           : fail ?? '',
      GH_LIVE           : live.join('\n'),
      MISE_PROJECT_ROOT : root
    }
  })

  return { calls: await logged(scratch), status, stdout }
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
  const copy = join(scratch, '.mise', 'tasks', 'repo', 'sync', 'labels')

  await plant(scratch, { '.mise/config.toml': '' })
  await cp(task, copy)

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
