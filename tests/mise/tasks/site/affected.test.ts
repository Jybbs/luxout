/** @module-tag spawns */
import { existsSync }  from 'node:fs'
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
 * whose branch changes only `changed`, or deletes it where `deleted` is set,
 * since it left `origin/main`, where a
 * stand-in `mise` runs each task file it names and Vitest runs one site test,
 * which imports `.vitepress/lib/a.ts` and a module beside each `tsconfig.json`
 * under `src/`, one of them importing a package from the root `node_modules`,
 * under the site suite's own configuration.
 */
async function selected(
  changed : string,
  scratch : string,
  deleted = false,
  folder  = 'repo'
): Promise<{ ran: boolean, status: number | null }> {
  const repo = join(scratch, folder)
  const site = join(repo, 'site')

  await plant(repo, {
    '.gitignore'                      : '.cache\nnode_modules\n',
    'bun.lock'                        : '{}\n',
    'package.json'                    : '{ "type": "module" }\n',
    'site/.vitepress/lib/a.ts'        : 'export const a = 1\n',
    'site/.vitepress/lib/b.ts'        : 'export const b = 2\n',
    'site/.vitepress/tests/a.test.ts' : "import { expect, test } from 'vitest'\n\n"
                                      + "import { b } from '../../../src/b.ts'\n"
                                      + "import { page } from '../../../src/ui/public/index.ts'\n"
                                      + "import { a } from '../lib/a.ts'\n\n"
                                      + "test('reads a', () => {\n"
                                      + "  expect([a, b, page]).toEqual([1, 'Sun', 4])\n})\n",
    'site/.vitepress/tsconfig.json'   : '{}\n',
    'site/bun.lock'                   : '{}\n',
    'site/package.json'               : '{ "type": "module" }\n',
    'src/a.ts'                        : 'export const a = 1\n',
    'src/b.ts'                        : "import { Body } from 'astronomy-engine'\n\n"
                                      + 'export const b = Body.Sun\n',
    'src/tsconfig.json'               : '{}\n',
    'src/ui/public/index.ts'          : 'export const page = 4\n',
    'src/ui/public/tsconfig.json'     : '{}\n',
    'tests/tsconfig.json'             : '{}\n'
  })
  await Promise.all([
    ...['site/.vitepress/vitest.config.ts', 'tests/common/triggers.ts', 'tests/coverage.json']
      .map((file) => cp(join(root, file), join(repo, file))),
    cp(join(import.meta.dirname, '..', '..', 'fixtures', 'mise.sh'), join(scratch, 'bin', 'mise')),
    symlink(join(root, 'node_modules'), join(repo, 'node_modules')),
    symlink(join(root, 'site', 'node_modules'), join(site, 'node_modules'))
  ])

  await branch(changed, repo, deleted)

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
  { changed: 'site/.vitepress/lib/b.ts', name: 'runs no site test', ran: false },
  { changed: 'src/a.ts', name: 'runs no site test', ran: false },
  { changed: 'tests/tsconfig.json', name: 'runs no site test', ran: false },
  { changed: 'site/.vitepress/lib/a.ts', name: 'runs the site test', ran: true },
  { changed: 'bun.lock', name: 'runs every site test', ran: true },
  { changed: 'package.json', name: 'runs every site test', ran: true },
  { changed: 'site/.vitepress/tsconfig.json', name: 'runs every site test', ran: true },
  { changed: 'site/.vitepress/vitest.config.ts', name: 'runs every site test', ran: true },
  { changed: 'site/bun.lock', name: 'runs every site test', ran: true },
  { changed: 'site/package.json', name: 'runs every site test', ran: true },
  { changed: 'src/tsconfig.json', name: 'runs every site test', ran: true },
  { changed: 'src/ui/public/tsconfig.json', name: 'runs every site test', ran: true }
])(
  '$name where a branch changes only $changed',
  async ({ changed, ran }, { scratch }) => {
    expect(await selected(changed, scratch)).toEqual({ ran: ran, status: 0 })
  }
)

test.for([
  { deleted: 'tests/tsconfig.json', name: 'runs no site test', ran: false },
  { deleted: 'site/.vitepress/tsconfig.json', name: 'runs every site test', ran: true },
  { deleted: 'site/package.json', name: 'runs every site test', ran: true },
  { deleted: 'src/ui/public/tsconfig.json', name: 'runs every site test', ran: true }
])(
  '$name where a branch deletes only $deleted',
  async ({ deleted, ran }, { scratch }) => {
    expect(await selected(deleted, scratch, true)).toEqual({ ran: ran, status: 0 })
    expect(existsSync(join(scratch, 'repo', deleted))).toBe(false)
  }
)

test.for([
  { changed: 'bun.lock', name: 'runs every site test', ran: true },
  { changed: 'package.json', name: 'runs every site test', ran: true },
  { changed: 'site/.vitepress/tsconfig.json', name: 'runs every site test', ran: true },
  { changed: 'site/.vitepress/vitest.config.ts', name: 'runs every site test', ran: true },
  { changed: 'site/bun.lock', name: 'runs every site test', ran: true },
  { changed: 'site/package.json', name: 'runs every site test', ran: true },
  { changed: 'src/tsconfig.json', name: 'runs every site test', ran: true },
  { changed: 'src/ui/public/tsconfig.json', name: 'runs every site test', ran: true }
])(
  '$name where a branch changes only $changed in a checkout under luxout (old)',
  async ({ changed, ran }, { scratch }) => {
    expect(await selected(changed, scratch, false, 'luxout (old)')).toEqual({ ran: ran, status: 0 })
  }
)
