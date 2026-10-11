import { expect } from 'vitest'

import { confirm, sync } from '../../../../common/sync.js'
import { plant, test }   from '../../../../common/scratch.js'

const ENDPOINT = 'repos/{owner}/{repo}/labels'

const registry = [
  '["🐞 bug"]',
  'color       = "c62d42"',
  'description = "A defect, filed beside the label of the domain where it breaks"',
  '',
  String.raw`["🧪 it's \"odd\""]`,
  'color       = "8cc5a3"',
  String.raw`description = "-Quotes ' and \" and $HOME and \\ stay as written"`
].join('\n')

const LISTING = ['api', '--jq', '.[].name', '--paginate', ENDPOINT]

/**
 * Runs the task over the registry `toml` holds in `scratch`, with `live`
 * naming each label GitHub holds and `fail` the command whose calls fail.
 */
async function labels(
  toml                : string,
  scratch             : string,
  { fail, live = [] } : { fail?: 'api' | 'label', live?: string[] } = {}
): Promise<{ calls: string[][], status: number | null, stdout: string }> {
  await plant(scratch, { '.github/labels.toml': toml })

  const { calls, status, stdout } = await sync(scratch, 'repo:sync:labels', {
    fail : fail,
    live : { [ENDPOINT]: [live.map((name) => ({ name }))] }
  })

  return { calls: calls.map(({ args }) => args), status, stdout }
}

test('creates or updates each declared label with every value as written', async ({ scratch }) => {
  expect(await labels(registry, scratch, { live: ['🐞 bug', '🧪 it\'s "odd"'] })).toEqual({
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
  const { calls, status, stdout } = await labels(registry, scratch, {
    live: ['🔦 discovery', '🐞 bug', 'wontfix']
  })

  expect({ commands: calls.map((call) => call.slice(0, 2)), status, stdout }).toEqual({
    commands : [['label', 'create'], ['label', 'create'], LISTING.slice(0, 2)],
    status   : 0,
    stdout   : 'GitHub holds labels no file declares, left in place:\n  🔦 discovery\n  wontfix\n'
  })
})

test('creates nothing where the registry declares no label', async ({ scratch }) => {
  expect(await labels('', scratch)).toEqual({ calls: [LISTING], status: 0, stdout: '' })
})

test('writes nothing where the registry fails to parse', async ({ scratch }) => {
  expect(await labels('["🐞 bug"]\ncolor = [\n', scratch)).toMatchObject({ calls: [], status: 1 })
})

test('stops before listing the live labels where a create fails', async ({ scratch }) => {
  const { calls, status } = await labels(registry, scratch, { fail: 'label' })

  expect({ commands: calls.map(([command]) => command), failed: status !== 0 })
    .toEqual({ commands: ['label', 'label'], failed: true })
})

test('fails without listing where reading the live labels fails', async ({ scratch }) => {
  expect(await labels(registry, scratch, { fail: 'api' })).toMatchObject({ status: 1, stdout: '' })
})

test('asks before writing when run as labels, failing with no terminal to answer', async ({ scratch }) => {
  expect(await confirm('labels', scratch, 'repo:sync:labels')).toEqual({ asked: true, status: 1 })
}, 30_000)
