/** @module-tag spawns */
import { execFileSync }            from 'node:child_process'
import { appendFile, cp, symlink } from 'node:fs/promises'
import { join }                    from 'node:path'

import { expect } from 'vitest'

import { plant, test } from '../../../common/scratch.js'
import { sync }        from '../../../common/sync.js'

const ARGS   = ['--bail', '1']
const BASE   = '5cb3ee2'
const MERGE  = ['git', 'merge-base', 'origin/main', 'HEAD']
const root   = join(import.meta.dirname, '..', '..', '..', '..')
const PLUGIN = ['mise', 'run', 'plugin:test', '--', '--changed', BASE, ...ARGS]

/**
 * Runs the task in `scratch` beside stand-ins for `git` and `mise`, where the
 * merge base is `BASE` and the call `failing` names exits 1.
 */
async function canned(
  scratch  : string,
  failing? : string[]
): Promise<{ calls: string[][], status: number | null }> {
  const { invoked, status } = await sync(scratch, 'plugin:affected', {
    args   : ARGS,
    canned : {
      [MERGE.join(' ')]  : { stdout: `${BASE}\n` },
      [PLUGIN.join(' ')] : {},
      ...failing && { [failing.join(' ')]: { status: 1 } }
    }
  })

  return { calls: invoked.map((call) => call.args), status }
}

/**
 * Runs the task from a repository at `folder` under `scratch` whose branch
 * changes only `changed` since it left `origin/main`, where a stand-in `mise`
 * runs each task file it names and Vitest runs one plugin test, which imports
 * `src/a.ts`, under the suite's own configuration.
 */
async function selected(
  changed : string,
  scratch : string,
  folder  = 'repo'
): Promise<{ ran: boolean, status: number | null }> {
  const repo = join(scratch, folder)
  const git  = (...args: string[]): Buffer => execFileSync('git', [
    '-c', 'commit.gpgsign=false', '-c', 'user.email=luxout@example.com', '-c', 'user.name=Luxout', ...args
  ], { cwd: repo })

  await plant(repo, {
    '.gitignore'        : '.cache\n.vitest\nnode_modules\n',
    'package.json'      : '{ "type": "module" }\n',
    'site/index.md'     : '# Luxout\n',
    'site/package.json' : '{}\n',
    'src/a.ts'          : 'export const a = 1\n',
    'src/b.ts'          : 'export const b = 2\n',
    'src/package.json'  : '{}\n',
    'tests/a.test.ts'   : "import { expect, test } from 'vitest'\n\nimport { a } from '../src/a.ts'\n\n"
                        + "test('reads a', () => {\n  expect(a).toBe(1)\n})\n"
  })
  await Promise.all([
    cp(join(root, 'tests', 'coverage.json'), join(repo, 'tests', 'coverage.json')),
    cp(join(root, 'tests', 'vitest.config.ts'), join(repo, 'tests', 'vitest.config.ts')),
    cp(join(import.meta.dirname, '..', '..', 'fixtures', 'mise.sh'), join(scratch, 'bin', 'mise')),
    symlink(join(root, 'node_modules'), join(repo, 'node_modules'))
  ])

  git('init', '--quiet')
  git('add', '--all')
  git('commit', '--message', 'Start', '--quiet')
  git('update-ref', 'refs/remotes/origin/main', 'HEAD')
  await appendFile(join(repo, changed), '\n')
  git('commit', '--all', '--message', 'Change', '--quiet')

  const { status, stdout } = await sync(scratch, 'plugin:affected', { cwd: repo, env: { NO_COLOR: '1' } })

  return { ran: /Tests +1 passed/.test(stdout), status }
}

test('takes the alias affected', () => {
  const info = execFileSync('mise', ['tasks', 'info', '--json', 'plugin:affected'], {
    cwd      : root,
    encoding : 'utf8'
  })

  expect(JSON.parse(info)).toMatchObject({ aliases: ['affected'] })
})

test(
  'runs plugin:test against the merge base, passing every further argument to Vitest',
  async ({ scratch }) => {
    expect(await canned(scratch)).toEqual({ calls: [MERGE, PLUGIN], status: 0 })
  }
)

test.for([
  { calls: [MERGE], failing: MERGE, name: '`git merge-base`' },
  { calls: [MERGE, PLUGIN], failing: PLUGIN, name: '`plugin:test`' }
])('fails once $name fails', async ({ calls, failing }, { scratch }) => {
  expect(await canned(scratch, failing)).toEqual({ calls: calls, status: 1 })
})

test.for([
  { changed: 'site/index.md', name: 'runs no plugin test', ran: false },
  { changed: 'site/package.json', name: 'runs no plugin test', ran: false },
  { changed: 'src/b.ts', name: 'runs no plugin test', ran: false },
  { changed: 'src/a.ts', name: 'runs the plugin test', ran: true },
  { changed: 'package.json', name: 'runs every plugin test', ran: true },
  { changed: 'src/package.json', name: 'runs every plugin test', ran: true },
  { changed: 'tests/vitest.config.ts', name: 'runs every plugin test', ran: true }
])(
  '$name where a branch changes only $changed',
  async ({ changed, ran }, { scratch }) => {
    expect(await selected(changed, scratch)).toEqual({ ran: ran, status: 0 })
  }
)

test.for([
  { changed: 'site/package.json', name: 'runs no plugin test', ran: false },
  { changed: 'package.json', name: 'runs every plugin test', ran: true },
  { changed: 'src/package.json', name: 'runs every plugin test', ran: true }
])(
  '$name where a branch changes only $changed in a checkout under luxout (old)',
  async ({ changed, ran }, { scratch }) => {
    expect(await selected(changed, scratch, 'luxout (old)')).toEqual({ ran: ran, status: 0 })
  }
)
