/** @module-tag spawns */
import { cp, symlink } from 'node:fs/promises'
import { join }        from 'node:path'

import { expect } from 'vitest'

import { branch, plant, test } from '../../../common/scratch.js'
import { type SyncRun, sync }  from '../../../common/sync.js'

const ARGS  = ['--bail', '1']
const BASE  = '5cb3ee2'
const MERGE = ['git', 'merge-base', 'origin/main', 'HEAD']
const root  = join(import.meta.dirname, '..', '..', '..', '..')
const SITE  = ['mise', 'run', 'site:test', '--', '--changed', BASE, ...ARGS]

/**
 * Runs the task in `scratch` beside stand-ins for `git` and `mise`, where the
 * merge base is `BASE` and the call `failing` names exits 1.
 */
function run(scratch: string, failing?: string[]): Promise<SyncRun> {
  return sync(scratch, 'site:affected', {
    args   : ARGS,
    canned : {
      [MERGE.join(' ')] : { stdout: `${BASE}\n` },
      [SITE.join(' ')]  : {},
      ...failing && { [failing.join(' ')]: { status: 1 } }
    }
  })
}

/**
 * Runs the task from the site of a repository at `folder` under `scratch`
 * whose branch changes only `changed` since it left `origin/main`, where a
 * stand-in `mise` runs each task file it names and Vitest runs one site test,
 * which imports `.vitepress/lib/a.ts`, under the site suite's own
 * configuration.
 */
async function selected(
  changed : string,
  scratch : string,
  folder  = 'repo'
): Promise<{ ran: boolean, status: number | null }> {
  const repo = join(scratch, folder)
  const site = join(repo, 'site')

  await plant(repo, {
    '.gitignore'                      : '.cache\nnode_modules\n',
    'package.json'                    : '{ "type": "module" }\n',
    'site/.vitepress/lib/a.ts'        : 'export const a = 1\n',
    'site/.vitepress/lib/b.ts'        : 'export const b = 2\n',
    'site/.vitepress/tests/a.test.ts' : "import { expect, test } from 'vitest'\n\n"
                                      + "import { a } from '../lib/a.ts'\n\n"
                                      + "test('reads a', () => {\n  expect(a).toBe(1)\n})\n",
    'site/package.json'               : '{ "type": "module" }\n',
    'src/a.ts'                        : 'export const a = 1\n'
  })
  await Promise.all([
    cp(join(root, 'site', '.vitepress', 'vitest.config.ts'), join(site, '.vitepress', 'vitest.config.ts')),
    cp(join(root, 'tests', 'coverage.json'), join(repo, 'tests', 'coverage.json')),
    cp(join(import.meta.dirname, '..', '..', 'fixtures', 'mise.sh'), join(scratch, 'bin', 'mise')),
    symlink(join(root, 'site', 'node_modules'), join(site, 'node_modules'))
  ])

  await branch(changed, repo)

  const { status, stdout } = await sync(scratch, 'site:affected', { cwd: site, env: { NO_COLOR: '1' } })

  return { ran: /Tests +1 passed/.test(stdout), status }
}

test(
  'runs site:test against the merge base, passing every further argument to Vitest',
  async ({ scratch }) => {
    expect(await run(scratch)).toMatchObject({ commands: [MERGE, SITE], status: 0 })
  }
)

test.for([
  { commands: [MERGE], failing: MERGE, name: '`git merge-base`' },
  { commands: [MERGE, SITE], failing: SITE, name: '`site:test`' }
])('fails once $name fails', async ({ commands, failing }, { scratch }) => {
  expect(await run(scratch, failing)).toMatchObject({ commands: commands, status: 1 })
})

test.for([
  { changed: 'package.json', name: 'runs no site test', ran: false },
  { changed: 'site/.vitepress/lib/b.ts', name: 'runs no site test', ran: false },
  { changed: 'src/a.ts', name: 'runs no site test', ran: false },
  { changed: 'site/.vitepress/lib/a.ts', name: 'runs the site test', ran: true },
  { changed: 'site/.vitepress/vitest.config.ts', name: 'runs every site test', ran: true },
  { changed: 'site/package.json', name: 'runs every site test', ran: true }
])(
  '$name where a branch changes only $changed',
  async ({ changed, ran }, { scratch }) => {
    expect(await selected(changed, scratch)).toEqual({ ran: ran, status: 0 })
  }
)

test.for([
  { changed: 'package.json', name: 'runs no site test', ran: false },
  { changed: 'site/package.json', name: 'runs every site test', ran: true },
  { changed: 'site/.vitepress/vitest.config.ts', name: 'runs every site test', ran: true }
])(
  '$name where a branch changes only $changed in a checkout under luxout (old)',
  async ({ changed, ran }, { scratch }) => {
    expect(await selected(changed, scratch, 'luxout (old)')).toEqual({ ran: ran, status: 0 })
  }
)
