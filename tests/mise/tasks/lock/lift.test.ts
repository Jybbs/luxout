import { execFileSync }      from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { join }              from 'node:path'

import { expect } from 'vitest'

import { plant, test }       from '../../../common/scratch.js'
import { type Answer, sync } from '../../../common/sync.js'

interface Setup {
  args?   : string[]
  canned? : Record<string, Answer>
  edits?  : Record<string, string>
  files?  : Record<string, string>
  live?   : Record<string, unknown>
  staged? : boolean
}

const ADVISORIES = {
  vitest: [
    { id: 1, url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', vulnerable_versions: '<5.0.4' },
    { id: 2, url: 'https://github.com/advisories/GHSA-dddd-eeee-ffff', vulnerable_versions: '<5.0.6' },
    { id: 3, url: 'https://github.com/advisories/GHSA-gggg-hhhh-iiii', vulnerable_versions: '<5.0.1' }
  ]
}
const CHECKOUT = '1'.repeat(40)
const LIFTED   = '2'.repeat(40)
const PINNED   = '3'.repeat(40)
const RELOCK   = ['mise', 'run', 'lock:sync']
const VERIFY   = ['mise', 'run', 'repo:verify']
const ago      = (days: number): string => new Date(Date.now() - days * 86_400_000).toISOString()
const json     = (value: unknown, status = 0): Answer => ({ status, stdout: JSON.stringify(value) })
const root     = join(import.meta.dirname, '..', '..', '..', '..')
const CURRENT: Record<string, Answer> = {
  'bun audit --cwd . --json'            : json({}),
  'bun outdated --cwd .'                : outdated(),
  'bun outdated --cwd site'             : outdated(),
  'mise latest node@24'                 : { stdout: '24.21.0\n' },
  'mise latest node@26'                 : { stdout: '26.10.0\n' },
  'mise outdated --bump --json --local' : json({}),
  'mise version --json': json({ latest: '2026.9.18', version: '2026.10.12 macos-arm64 (2026-10-16)' })
}
const FILES = {
  '.github/actions/provision/action.yml' : `runs:\n  steps:\n    - uses : jdx/mise-action@${PINNED}\n`,
  '.github/workflows/release.yml'        : 'jobs:\n  publish:\n    steps:\n'
                                         + `      - uses : actions/checkout@${CHECKOUT}\n`,
  '.gitignore'                           : '/*.log\n/.cache/\n/bin/\n/tmp/\n',
  '.mise/holds.toml'                     : '["@homebridge/hap-nodejs"]\nfollows = "homebridge"\n\n'
                                         + '["@types/node"]\nreason = "Stays on the 22 line"\n',
  '.mise/tasks/plugin/lines.toml'        : '["plugin:test:22"]\ntools = { node = "22.23.3" }\n\n'
                                         + '["plugin:test:24"]\ntools = { node = "24.21.0" }\n',
  'site/package.json': JSON.stringify({ devDependencies: { vitest: '5.0.3' } }, null, 2) + '\n',

  '.github/workflows/ci.yml': [
    'jobs:',
    '  check:',
    '    steps:',
    `      - uses : actions/checkout@${CHECKOUT}`,
    '',
    '    strategy:',
    '      matrix:',
    '        include:',
    '          - task  : plugin:test:22',
    '            tools : bun jq node@22.23.3',
    '',
    '          - task  : plugin:test:24',
    '            tools : bun jq node@24.21.0',
    ''
  ].join('\n'),

  '.mise/config.toml': [
    'min_version = "2026.9.18"',
    '',
    '[tools]',
    'bun    = "1.4.2"',
    'node   = "26.10.0"',
    'zizmor = "1.30.1"',
    ''
  ].join('\n'),

  'package.json': JSON.stringify({
    devDependencies : { '@types/node': '22.20.5', unbash: '5.0.0', vitest: '5.0.3' },
    engines         : { node: '^22.23.3 || ^24.21.0 || ^26.10.0' }
  }, null, 2) + '\n'
}
const LIVE: Record<string, unknown> = {
  'repos/actions/checkout/commits/v6.0.0'    : { sha: LIFTED },
  'repos/actions/checkout/releases/latest'   : { published_at: ago(3), tag_name: 'v6.0.0' },
  'repos/jdx/mise-action/commits/v5.1.1'     : { sha: PINNED },
  'repos/jdx/mise-action/releases/latest'    : { published_at: ago(9), tag_name: 'v5.1.1' },
  'repos/actions/checkout/tags?per_page=100' : [[
    { commit: { sha: CHECKOUT }, name: 'v5' },
    { commit: { sha: LIFTED }, name: 'v6.0.0' },
    { commit: { sha: CHECKOUT }, name: 'v5.1.0' }
  ]]
}
const release = (days: number, version: string): Answer => json([{ created_at: ago(days), version }])
const CANNED: Record<string, Answer> = {
  'bun audit --cwd site --json'                    : json({}),
  'bun info --json @types/node time'               : json({ '26.6.5': ago(8) }),
  'bun info --json unbash time'                    : json({ '6.0.0': ago(1) }),
  'bun info --json vitest time'                    : json({ '5.0.5': ago(2) }),
  'bun outdated --cwd site'                        : outdated(['vitest (dev)', '5.0.3', '5.0.5']),
  'mise config get --file .mise/config.toml min_version': { stdout: '2026.9.18\n' },
  'mise config get --file .mise/config.toml tools.node': { stdout: '26.10.0\n' },
  'mise latest node@22'                            : { stdout: '22.23.3\n' },
  'mise latest node@24'                            : { stdout: '24.22.0\n' },
  'mise latest node@26'                            : { stdout: '26.12.0\n' },
  'mise ls-remote --json aqua:jdx/mise 2026.10.12' : release(1, '2026.10.12'),
  'mise ls-remote --json bun 1.4.3': json([{ created_at: ago(7), version: '1.4.3' }, { version: '1.4.30' }]),
  'mise ls-remote --json node 24.22.0'             : release(3, '24.22.0'),
  'mise ls-remote --json node 26.12.0'             : release(3, '26.12.0'),
  'mise ls-remote --json zizmor 1.31.1'            : json([{ version: '1.31.1' }]),
  'mise run lock:sync'                             : {},
  'mise run repo:verify'                           : {},
  'bun audit --cwd . --json'                       : json(ADVISORIES, 1),
  'mise version --json': json({ latest: '2026.10.12', version: '2026.10.12 macos-arm64 (2026-10-16)' }),

  'bun outdated --cwd .': outdated(
    ['@types/node (dev)', '22.20.5', '26.6.5'],
    ['unbash (dev)', '5.0.0', '6.0.0'],
    ['vitest (dev)', '5.0.3', '5.0.5']
  ),

  'mise outdated --bump --json --local': json({
    bun: {
      latest    : '1.4.3',
      name      : 'bun',
      requested : '1.4.2',
      source    : { path: `${root}/.mise/config.toml` }
    },

    node: {
      latest    : '27.0.0',
      name      : 'node',
      requested : '26.10.0',
      source    : { path: `${root}/.mise/config.toml` }
    },

    zizmor: {
      latest    : '1.31.1',
      name      : 'zizmor',
      requested : '1.30.1',
      source    : { path: `${root}/.mise/config.toml` }
    }
  }),

  'mise tasks ls --hidden --json --local': json([
    { name: 'plugin:test', source: `${root}/.mise/tasks/plugin/test`, tools: {} },
    { name: 'plugin:test:22', source: `${root}/.mise/tasks/plugin/lines.toml`, tools: { node: '22.23.3' } },
    { name: 'plugin:test:24', source: `${root}/.mise/tasks/plugin/lines.toml`, tools: { node: '24.21.0' } }
  ])
}
const LIFT = {
  ...FILES,
  '.mise/config.toml'             : 'min_version = "2026.10.12"\n\n[tools]\n'
                                  + 'bun    = "1.4.3"\nnode   = "26.12.0"\nzizmor = "1.31.1"\n',
  '.github/workflows/release.yml' : FILES['.github/workflows/release.yml'].replace(CHECKOUT, LIFTED),
  '.mise/tasks/plugin/lines.toml' : FILES['.mise/tasks/plugin/lines.toml'].replace('24.21.0', '24.22.0'),
  'site/package.json'             : JSON.stringify({ devDependencies: { vitest: '5.0.5' } }, null, 2) + '\n',

  '.github/workflows/ci.yml': FILES['.github/workflows/ci.yml']
    .replace(CHECKOUT, LIFTED)
    .replace('node@24.21.0', 'node@24.22.0'),

  'package.json': JSON.stringify({
    devDependencies : { '@types/node': '22.20.5', unbash: '6.0.0', vitest: '5.0.5' },
    engines         : { node: '^22.23.3 || ^24.22.0 || ^26.12.0' }
  }, null, 2) + '\n'
}
const SETTLED: Record<string, unknown> = {
  ...LIVE,
  'repos/actions/checkout/commits/v5.1.0'  : { sha: CHECKOUT },
  'repos/actions/checkout/releases/latest' : { published_at: ago(30), tag_name: 'v5.1.0' }
}

/**
 * Commits `files` over the fixture checkout in `scratch` and writes `edits`
 * over it uncommitted, then runs the task there with `args`.
 *
 * Stand-ins for `mise` and `bun` answer each call `canned` keys, and a
 * stand-in `gh` answers each endpoint `live` keys.
 *
 * Returns:
 *   The run, beside each task it runs through `mise run`, led by whether it
 *   ran in the checkout or in a clone, and whether `git status` changed.
 */
async function lift(
  scratch                                                                        : string,
  { args = [], canned = {}, edits = {}, files = {}, live = LIVE, staged = false } : Setup = {}
) {
  const git = (...words: string[]): string => execFileSync('git', words, {
    cwd      : scratch,
    encoding : 'utf8',
    env      : {
      GIT_AUTHOR_EMAIL    : 'lift@example.com',
      GIT_AUTHOR_NAME     : 'Lift',
      GIT_COMMITTER_EMAIL : 'lift@example.com',
      GIT_COMMITTER_NAME  : 'Lift',
      GIT_CONFIG_GLOBAL   : '/dev/null',
      GIT_CONFIG_NOSYSTEM : '1',
      PATH                : process.env.PATH
    }
  })

  await plant(scratch, { ...FILES, ...files })
  git('init', '--quiet')
  git('add', '--all')
  git('commit', '--message', 'Fixture', '--quiet')
  await plant(scratch, edits)

  if (staged) git('add', '--all')

  const before = git('status', '--porcelain')

  const { invoked, status, stderr, stdout } = await sync(scratch, 'lock:lift', {
    args   : args,
    canned : { ...CANNED, ...canned },
    live   : live
  })

  return {
    invoked : invoked,
    moved   : before !== git('status', '--porcelain'),
    status  : status,
    stderr  : stderr,
    stdout  : stdout,
    steps   : invoked
      .filter(({ args: [program, verb] }) => program === 'mise' && verb === 'run')
      .map(({ args, cwd }) => [cwd === scratch ? 'checkout' : 'clone', ...args])
  }
}

function outdated(...rows: [string, string, string][]): Answer {
  return {
    stdout: [
      'bun outdated v1.4.2 (744846f84)',
      '|--------------------------------------|',
      '| Package | Current | Update | Latest |',
      '|---------|---------|--------|--------|',
      ...rows
        .map(([name, current, latest]) => `| ${name} | ${current} | ${current} | ${latest} |`)
        .flatMap((line, index) => index === 0 ? [line] : ['|---------|---------|--------|--------|', line]),
      '|--------------------------------------|',
      ''
    ].join('\n')
  }
}

async function read(scratch: string): Promise<Record<string, string>> {
  const files = Object.keys(FILES)

  return Object.fromEntries(await Promise.all(files.map(async (file) => [
    file,
    await readFile(join(scratch, file), 'utf8')
  ])))
}

function row(stdout: string, pin: string): string[] {
  return stdout.split('\n')
    .find((line) => line.startsWith(`| ${pin} `))
    ?.split('|')
    .slice(1, -1)
    .map((cell) => cell.trim()) ?? []
}

test('prints every pin behind its newest release as one Markdown table', async ({ scratch }) => {
  const { status, steps, stdout } = await lift(scratch)

  expect({ status, steps, stdout }).toMatchInlineSnapshot(`
    {
      "status": 0,
      "stdout": "| **Pin**          | **Current** | **Newest** | **Major** | **Age** | **Clears**          | **Held** |
    | ---------------- | ----------- | ---------- | --------- | ------- | ------------------- | -------- |
    | @types/node      | 22.20.5     | 26.6.5     | yes       | 8 days  |                     | yes      |
    | actions/checkout | v5.1.0      | v6.0.0     | yes       | 3 days  |                     |          |
    | bun              | 1.4.2       | 1.4.3      | no        | 7 days  |                     |          |
    | min_version      | 2026.9.18   | 2026.10.12 | no        | 1 day   |                     |          |
    | node             | 26.10.0     | 26.12.0    | no        | 3 days  |                     |          |
    | plugin:test:24   | 24.21.0     | 24.22.0    | no        | 3 days  |                     |          |
    | unbash           | 5.0.0       | 6.0.0      | yes       | 1 day   |                     |          |
    | vitest           | 5.0.3       | 5.0.5      | no        | 2 days  | GHSA-aaaa-bbbb-cccc |          |
    | zizmor           | 1.30.1      | 1.31.1     | no        |         |                     |          |
    ",
      "steps": [],
    }
  `)
}, 60_000)

test.for([{ args: [] }, { args: ['--try', '--write'] }])(
  'prints only that every pin stands at its newest release where none lags, given $args',
  { timeout: 60_000 },
  async ({ args }, { scratch }) => {
    const { status, steps, stdout } = await lift(scratch, { args, canned: CURRENT, live: SETTLED })

    expect({ status, steps, stdout }).toEqual({
      status : 0,
      steps  : [],
      stdout : 'Every pin stands at its newest release\n'
    })
  }
)

test.for([
  { current: '0.33.1', major: 'yes', newest: '0.34.0' },
  { current: '0.0.3', major: 'yes', newest: '0.0.4' },
  { current: '7.0.2003', major: 'no', newest: '7.0.2004' },
  { current: '2026.9.18', major: 'no', newest: '2026.10.8' }
])(
  'counts $current to $newest as major only where the left-most non-zero part changes',
  { timeout: 60_000 },
  async ({ current, major, newest }, { scratch }) => {
    const { stdout } = await lift(scratch, {
      files  : { 'package.json': JSON.stringify({ devDependencies: { pkg: current } }) },
      live   : SETTLED,
      canned : {
        ...CURRENT,
        'bun info --json pkg time' : json({ [newest]: ago(1) }),
        'bun outdated --cwd .'     : outdated(['pkg (dev)', current, newest])
      }
    })

    expect(row(stdout, 'pkg')[3]).toBe(major)
  }
)

test('shows an untagged action pin by its short commit and counts its lift as major', async ({ scratch }) => {
  const { stdout } = await lift(scratch, {
    live: { ...LIVE, 'repos/actions/checkout/tags?per_page=100': [[]] }
  })

  expect(row(stdout, 'actions/checkout').slice(0, 4)).toEqual([
    'actions/checkout', '1111111', 'v6.0.0', 'yes'
  ])
}, 60_000)

test.for([
  { args: ['--hold'], message: '`--hold` takes the name of a pin the table lists\n' },
  {
    args    : ['--frobnicate'],
    message : '`--frobnicate` is no flag `lock:lift` takes, '
            + 'which are `--hold <pin>`, `--try`, and `--write`\n'
  }
])(
  'exits 2 on the arguments $args before reading any pin',
  { timeout: 60_000 },
  async ({ args, message }, { scratch }) => {
    const { invoked, status, stderr } = await lift(scratch, { args })

    expect({ invoked, status, stderr }).toEqual({ invoked: [], status: 2, stderr: message })
  }
)

test('exits 2 on a --hold naming no pin the table lists, before any trial or write', async ({ scratch }) => {
  const { moved, status, stderr, steps, stdout } = await lift(scratch, {
    args: ['--hold', 'unbash', '--hold', 'leftpad', '--try', '--write']
  })

  expect({ moved, status, stderr, steps, table: stdout.startsWith('| **Pin**') }).toEqual({
    moved  : false,
    status : 2,
    stderr : '`--hold` names `leftpad`, which no row of the table lists\n',
    steps  : [],
    table  : true
  })
}, 60_000)

test('writes every pin into its manifest in place, then relocks in the checkout', async ({ scratch }) => {
  const { status, steps } = await lift(scratch, { args: ['--write'] })

  expect({ files: await read(scratch), status, steps }).toEqual({
    files  : LIFT,
    status : 0,
    steps  : [['checkout', ...RELOCK]]
  })
}, 60_000)

test('holds a pin --hold names where it stands and marks it held', async ({ scratch }) => {
  const { stdout } = await lift(scratch, { args: ['--hold', 'unbash', '--write'] })
  const manifest   = JSON.parse((await read(scratch))['package.json'] ?? '{}')

  expect({ held: row(stdout, 'unbash')[6], unbash: manifest.devDependencies.unbash }).toEqual({
    held   : 'yes',
    unbash : '5.0.0'
  })
}, 60_000)

test('trials the lift in a scratch clone, leaving the checkout as it was', async ({ scratch }) => {
  const { moved, status, steps, stdout } = await lift(scratch, { args: ['--try'] })
  const log                              = await readFile(join(scratch, '.cache/lift/whole.log'), 'utf8')

  expect({ files: await read(scratch), log: log.split('\n')[0], moved, status, steps, stdout }).toEqual({
    files  : FILES,
    log    : 'Lifting actions/checkout, bun, min_version, node, plugin:test:24, unbash, vitest, zizmor',
    moved  : false,
    status : 0,
    steps  : [['clone', ...RELOCK], ['clone', ...VERIFY]],
    stdout : expect.stringContaining('The whole lift passes `mise ci`, logged at .cache/lift/whole.log')
  })
}, 60_000)

test.for<{ edits: Record<string, string>, kind: string, staged: boolean }>([
  { edits: { 'notes.txt': 'carried\n' }, kind: 'untracked', staged: false },
  {
    edits  : { '.mise/holds.toml': '["@types/node"]\nreason = "carried"\n' },
    kind   : 'uncommitted',
    staged : false
  },
  {
    edits  : { '.mise/holds.toml': '["@types/node"]\nreason = "carried"\n' },
    kind   : 'staged',
    staged : true
  }
])(
  'carries the checkout’s $kind files into the clone it trials',
  { timeout: 60_000 },
  async ({ edits, staged }, { scratch }) => {
    const { status, steps, stdout } = await lift(scratch, {
      args   : ['--try'],
      canned : { 'mise run repo:verify': { breaks: 'carried' } },
      edits  : edits,
      staged : staged
    })

    expect({ status, steps, stdout }).toEqual({
      status : 1,
      steps  : expect.arrayContaining([['clone', ...VERIFY]]),
      stdout : expect.stringContaining('The whole lift fails `mise ci`')
    })
  }
)

test('names the major lift that breaks the tree by holding back each in turn', async ({ scratch }) => {
  const { status, stdout } = await lift(scratch, {
    args   : ['--try'],
    canned : { 'mise run repo:verify': { breaks: '"unbash": "6.0.0"' } }
  })
  const logs = await readdir(join(scratch, '.cache', 'lift'))

  expect({ logs: logs.toSorted(), status, verdict: stdout.split('\n').slice(-4, -1) }).toEqual({
    logs    : ['whole.log', 'without-actions-checkout.log', 'without-unbash.log'],
    status  : 1,
    verdict : [
      'The whole lift fails `mise ci`, logged at .cache/lift/whole.log',
      'Holding back `actions/checkout` still fails `mise ci`, logged at '
    + '.cache/lift/without-actions-checkout.log',
      'Holding back `unbash` passes `mise ci`, so lifting `unbash` breaks the tree, logged at '
    + '.cache/lift/without-unbash.log'
    ]
  })
}, 60_000)

test('reports that no single major lift accounts for a failure no hold-back clears', async ({ scratch }) => {
  const { status, stderr } = await lift(scratch, {
    args   : ['--try'],
    canned : { 'mise run repo:verify': { breaks: '"vitest": "5.0.5"' } }
  })

  expect({ status, stderr }).toEqual({
    status : 1,
    stderr : 'No single major lift accounts for the failure, whose logs sit under .cache/lift/\n'
  })
}, 60_000)

test.for([
  { breaks: undefined, files: LIFT, outcome: 'writes after a passing trial' },
  { breaks: '"unbash": "6.0.0"', files: FILES, outcome: 'writes nothing after a failing trial' }
])(
  '$outcome when given both --try and --write',
  { timeout: 60_000 },
  async ({ breaks, files }, { scratch }) => {
    await lift(scratch, { args: ['--try', '--write'], canned: { 'mise run repo:verify': { breaks } } })

    expect(await read(scratch)).toEqual(files)
  }
)

test('stops before any trial or write where min_version would pass the running mise', async ({ scratch }) => {
  const { moved, status, stderr, steps } = await lift(scratch, {
    args   : ['--try', '--write'],
    canned : {
      'mise version --json': json({ latest: '2026.10.12', version: '2026.10.11 macos-arm64 (2026-10-15)' })
    }
  })

  expect({ moved, status, stderr, steps }).toEqual({
    moved  : false,
    status : 1,
    stderr : 'Lifting `min_version` to 2026.10.12 needs mise 2026.10.12 or later, '
           + 'whereas mise 2026.10.11 runs here, so update mise or hold `min_version`\n',
    steps  : []
  })
}, 60_000)

test('lifts nothing where every pin the table lists is held', async ({ scratch }) => {
  const { status, steps, stdout } = await lift(scratch, {
    args   : ['--write'],
    canned : { ...CURRENT, 'bun outdated --cwd .': outdated(['@types/node (dev)', '22.20.5', '26.6.5']) },
    live   : SETTLED
  })

  expect({ last: stdout.split('\n').at(-2), status, steps }).toEqual({
    last   : 'Nothing is lifted, since every pin the table lists is held',
    status : 0,
    steps  : []
  })
}, 60_000)

test('stops before printing a table where bun audit fails without a report', async ({ scratch }) => {
  const { status, stdout } = await lift(scratch, {
    canned: { 'bun audit --cwd . --json': { status: 1, stdout: 'error: the registry timed out\n' } }
  })

  expect({ failed: status !== 0, stdout }).toEqual({ failed: true, stdout: '' })
}, 60_000)

test('lists no min_version row where mise reports no newest release', async ({ scratch }) => {
  const { invoked, stdout } = await lift(scratch, {
    canned: { 'mise version --json': json({ version: '2026.10.12 macos-arm64 (2026-10-16)' }) }
  })

  const dated = invoked.some(({ args }) => args.includes('aqua:jdx/mise'))

  expect({ dated, row: row(stdout, 'min_version') }).toEqual({ dated: false, row: [] })
}, 60_000)

test('lifts the rest under an older mise where min_version is held', async ({ scratch }) => {
  const { status, steps } = await lift(scratch, {
    args   : ['--hold', 'min_version', '--write'],
    canned : {
      'mise version --json': json({ latest: '2026.10.12', version: '2026.10.11 macos-arm64 (2026-10-15)' })
    }
  })

  expect({ config: (await read(scratch))['.mise/config.toml'], status, steps }).toEqual({
    config : LIFT['.mise/config.toml'].replace('2026.10.12', '2026.9.18'),
    status : 0,
    steps  : [['checkout', ...RELOCK]]
  })
}, 60_000)

test('clears the logs an earlier trial left before trialing again', async ({ scratch }) => {
  await lift(scratch, { args: ['--try'], files: { '.cache/lift/without-bun.log': 'stale\n' } })

  expect(await readdir(join(scratch, '.cache', 'lift'))).toEqual(['whole.log'])
}, 60_000)

test('moves only the pin each edit names where another pin in its manifest shares the release', async ({
  scratch
}) => {
  const shared     = { '@vitest/coverage-v8': '5.0.3', vitest: '5.0.3' }
  const { status } = await lift(scratch, {
    args   : ['--hold', 'vitest', '--write'],
    files  : { 'package.json': JSON.stringify({ devDependencies: shared }, null, 2) + '\n' },
    canned : {
      'bun info --json @vitest/coverage-v8 time' : json({ '5.0.5': ago(2) }),
      'bun outdated --cwd .'                     : outdated(
        ['@vitest/coverage-v8 (dev)', '5.0.3', '5.0.5'],
        ['vitest (dev)', '5.0.3', '5.0.5']
      )
    }
  })
  const manifest   = JSON.parse((await read(scratch))['package.json'] ?? '{}')

  expect({ pins: manifest.devDependencies, status }).toEqual({
    pins   : { '@vitest/coverage-v8': '5.0.5', vitest: '5.0.3' },
    status : 0
  })
}, 60_000)

test('lists an advisory both Bun packages report once in the row it clears', async ({ scratch }) => {
  const { stdout } = await lift(scratch, { canned: { 'bun audit --cwd site --json': json(ADVISORIES, 1) } })

  expect(row(stdout, 'vitest')[5]).toBe('GHSA-aaaa-bbbb-cccc')
}, 60_000)

test.for<{
  args       : string[]
  hap        : string
  homebridge : string
  leading    : [string, string, string][]
  leads      : string
}>([
  {
    args       : ['--write'],
    hap        : '2.2.3',
    homebridge : '2.5.0',
    leading    : [['homebridge (dev)', '2.4.0', '2.5.0']],
    leads      : 'lifts'
  },
  {
    args       : ['--hold', 'homebridge', '--write'],
    hap        : '2.2.2',
    homebridge : '2.4.0',
    leading    : [['homebridge (dev)', '2.4.0', '2.5.0']],
    leads      : 'is held'
  },
  { args: ['--write'], hap: '2.2.2', homebridge: '2.4.0', leading: [], leads: 'stands' }
])(
    'puts a pin that follows another at the release its leader names, '
  + 'with no row of its own, where the leader $leads',
  { timeout: 60_000 },
  async ({ args, hap, homebridge, leading }, { scratch }) => {
    const pins       = { '@homebridge/hap-nodejs': '2.2.2', homebridge: '2.4.0' }
    const { stdout } = await lift(scratch, {
      args   : args,
      files  : { 'package.json': JSON.stringify({ devDependencies: pins }, null, 2) + '\n' },
      canned : {
        'bun info --json @homebridge/hap-nodejs@^2.2.3 version' : json('2.2.3'),
        'bun info --json homebridge time'                      : json({ '2.5.0': ago(2) }),
        'bun info --json homebridge@2.5.0'                     : json({
          dependencies: { '@homebridge/hap-nodejs': '^2.2.3' }
        }),
        'bun outdated --cwd .': outdated(['@homebridge/hap-nodejs (dev)', '2.2.2', '2.2.4'], ...leading)
      }
    })
    const manifest   = JSON.parse((await read(scratch))['package.json'] ?? '{}')

    expect({ hap: row(stdout, '@homebridge/hap-nodejs'), pins: manifest.devDependencies }).toEqual({
      hap  : [],
      pins : { '@homebridge/hap-nodejs': hap, homebridge }
    })
  }
)
