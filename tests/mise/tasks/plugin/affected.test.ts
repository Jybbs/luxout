/** @module-tag spawns */
import { execFileSync } from 'node:child_process'
import { cp, symlink }  from 'node:fs/promises'
import { join }         from 'node:path'

import { expect } from 'vitest'

import { branch, plant, test } from '../../../common/scratch.js'
import { type SyncRun, sync }  from '../../../common/sync.js'

const ARGS   = ['--bail', '1']
const BASE   = '5cb3ee2'
const MERGE  = ['git', 'merge-base', 'origin/main', 'HEAD']
const root   = join(import.meta.dirname, '..', '..', '..', '..')
const PLUGIN = ['mise', 'run', 'plugin:test', '--', '--changed', BASE, ...ARGS]

/**
 * Runs the task in `scratch` beside stand-ins for `git` and `mise`, where the
 * merge base is `BASE` and the call `failing` names exits 1.
 */
function canned(scratch: string, failing?: string[]): Promise<SyncRun> {
  return sync(scratch, 'plugin:affected', {
    args   : ARGS,
    canned : {
      [MERGE.join(' ')]  : { stdout: `${BASE}\n` },
      [PLUGIN.join(' ')] : {},
      ...failing && { [failing.join(' ')]: { status: 1 } }
    }
  })
}

/**
 * Runs the task from a repository at `folder` under `scratch` whose branch
 * changes only `changed` since it left `origin/main`, where a stand-in `mise`
 * runs each task file it names and Vitest runs one plugin test, which imports
 * `src/a.ts` and a module beside each further `tsconfig.json`, under the
 * suite's own configuration.
 */
async function selected(
  changed : string,
  scratch : string,
  folder  = 'repo'
): Promise<{ ran: boolean, status: number | null }> {
  const repo = join(scratch, folder)

  await plant(repo, {
    '.gitignore'                       : '.cache\n.vitest\nnode_modules\n',
    '.mise/vet/index.ts'               : 'export const vet = 3\n',
    '.mise/vet/tsconfig.json'          : '{}\n',
    'bun.lock'                         : '{}\n',
    'bunfig.toml'                      : '{}\n',
    'package.json'                     : '{ "type": "module" }\n',
    'site/.vitepress/tsconfig.json'    : '{}\n',
    'site/.vitepress/vitest.config.ts' : '{}\n',
    'site/bun.lock'                    : '{}\n',
    'site/index.md'                    : '# Luxout\n',
    'site/package.json'                : '{}\n',
    'src/a.ts'                         : 'export const a = 1\n',
    'src/b.ts'                         : 'export const b = 2\n',
    'src/package.json'                 : '{}\n',
    'src/tsconfig.json'                : '{}\n',
    'src/ui/public/index.ts'           : 'export const page = 4\n',
    'src/ui/public/tsconfig.json'      : '{}\n',
    'tests/a.test.ts'                  : "import { expect, test } from 'vitest'\n\n"
                                       + "import { vet } from '../.mise/vet/index.ts'\n"
                                       + "import { a } from '../src/a.ts'\n"
                                       + "import { page } from '../src/ui/public/index.ts'\n\n"
                                       + "test('reads a', () => {\n"
                                       + '  expect([a, vet, page]).toEqual([1, 3, 4])\n})\n',
    'tests/homebridge/bun.lock'        : '{}\n',
    'tests/homebridge/bunfig.toml'     : '{}\n',
    'tests/tsconfig.json'              : '{}\n',
    'tests/vet/floor/bun.lock'         : '{}\n'
  })
  await Promise.all([
    ...['.mise/lib/lock.sh', 'tests/common/triggers.ts', 'tests/coverage.json', 'tests/vitest.config.ts']
      .map((file) => cp(join(root, file), join(repo, file))),
    cp(join(import.meta.dirname, '..', '..', 'fixtures', 'mise.sh'), join(scratch, 'bin', 'mise')),
    symlink(join(root, 'node_modules'), join(repo, 'node_modules'))
  ])

  await branch(changed, repo)

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
    expect(await canned(scratch)).toMatchObject({ commands: [MERGE, PLUGIN], status: 0 })
  }
)

test.for([
  { commands: [MERGE], failing: MERGE, name: '`git merge-base`' },
  { commands: [MERGE, PLUGIN], failing: PLUGIN, name: '`plugin:test`' }
])('fails once $name fails', async ({ commands, failing }, { scratch }) => {
  expect(await canned(scratch, failing)).toMatchObject({ commands: commands, status: 1 })
})

test.for([
  { changed: 'site/.vitepress/tsconfig.json', name: 'runs no plugin test', ran: false },
  { changed: 'site/index.md', name: 'runs no plugin test', ran: false },
  { changed: 'site/package.json', name: 'runs no plugin test', ran: false },
  { changed: 'src/b.ts', name: 'runs no plugin test', ran: false },
  { changed: 'tests/homebridge/bunfig.toml', name: 'runs no plugin test', ran: false },
  { changed: 'src/a.ts', name: 'runs the plugin test', ran: true },
  { changed: '.mise/vet/tsconfig.json', name: 'runs every plugin test', ran: true },
  { changed: 'bun.lock', name: 'runs every plugin test', ran: true },
  { changed: 'bunfig.toml', name: 'runs every plugin test', ran: true },
  { changed: 'package.json', name: 'runs every plugin test', ran: true },
  { changed: 'src/package.json', name: 'runs every plugin test', ran: true },
  { changed: 'site/.vitepress/vitest.config.ts', name: 'runs every plugin test', ran: true },
  { changed: 'site/bun.lock', name: 'runs every plugin test', ran: true },
  { changed: 'src/tsconfig.json', name: 'runs every plugin test', ran: true },
  { changed: 'src/ui/public/tsconfig.json', name: 'runs every plugin test', ran: true },
  { changed: 'tests/homebridge/bun.lock', name: 'runs every plugin test', ran: true },
  { changed: 'tests/tsconfig.json', name: 'runs every plugin test', ran: true },
  { changed: 'tests/vet/floor/bun.lock', name: 'runs every plugin test', ran: true },
  { changed: 'tests/vitest.config.ts', name: 'runs every plugin test', ran: true }
])(
  '$name where a branch changes only $changed',
  async ({ changed, ran }, { scratch }) => {
    expect(await selected(changed, scratch)).toEqual({ ran: ran, status: 0 })
  }
)

test.for([
  { changed: 'site/package.json', name: 'runs no plugin test', ran: false },
  { changed: '.mise/vet/tsconfig.json', name: 'runs every plugin test', ran: true },
  { changed: 'bun.lock', name: 'runs every plugin test', ran: true },
  { changed: 'package.json', name: 'runs every plugin test', ran: true },
  { changed: 'site/bun.lock', name: 'runs every plugin test', ran: true },
  { changed: 'src/package.json', name: 'runs every plugin test', ran: true }
])(
  '$name where a branch changes only $changed in a checkout under luxout (old)',
  async ({ changed, ran }, { scratch }) => {
    expect(await selected(changed, scratch, 'luxout (old)')).toEqual({ ran: ran, status: 0 })
  }
)
