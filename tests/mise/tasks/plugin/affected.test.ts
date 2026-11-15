/** @module-tag spawns */
import { execFileSync }       from 'node:child_process'
import { existsSync }         from 'node:fs'
import { cp, mkdir, symlink } from 'node:fs/promises'
import { join }               from 'node:path'

import { expect } from 'vitest'

import { branch, plant, test } from '../../../common/scratch.js'
import { type SyncRun, sync }  from '../../../common/sync.js'

const ARGS   = ['--bail', '1']
const BASE   = '5cb3ee2'
const MERGE  = ['git', 'merge-base', 'origin/main', 'HEAD']
const STORE  = '.mise/vet/node_modules/.bun/@luxout+base@1.0.0/node_modules/@luxout/base'
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
 * changes only `changed`, or deletes it where `deleted` is set, since it left
 * `origin/main`, where a stand-in `mise` runs each task file it names and
 * Vitest runs one plugin test under the suite's own configuration. The test
 * imports `src/a.ts`, which re-exports a module under `src/ui/public/`, and
 * imports `.mise/vet/index.ts` dynamically, whose tsconfig chain reaches a
 * package linked from a Bun isolated store.
 */
async function selected(
  changed : string,
  scratch : string,
  deleted = false,
  folder  = 'repo'
): Promise<{ ran: boolean, status: number | null }> {
  const repo = join(scratch, folder)

  await plant(repo, {
    '.gitignore'                       : '.cache\n.vitest\nnode_modules\n',
    '.mise/vet/bun.lock'               : '{}\n',
    '.mise/vet/index.ts'               : 'export const vet = 3\n',
    '.mise/vet/tsconfig.base.json'     : '{ "extends": ["./tsconfig.root", "@luxout/base"] }\n',
    '.mise/vet/tsconfig.empty.json'    : '',
    '.mise/vet/tsconfig.json'          : '{\n  // The vet suite\n  "extends": "./tsconfig.base.json"\n}\n',
    '.mise/vet/tsconfig.notes.json'    : '// The vet suite takes no option of its own\n',
    '.mise/vet/tsconfig.root.json'     : '\ufeff{ "extends": ["./tsconfig.empty.json", '
                                       + '"./tsconfig.notes.json"], }\n',
    'bun.lock'                         : '{}\n',
    'bunfig.toml'                      : '{}\n',
    'package.json'                     : '{ "type": "module" }\n',
    'site/.vitepress/tsconfig.json'    : '{}\n',
    'site/.vitepress/vitest.config.ts' : '{}\n',
    'site/bun.lock'                    : '{}\n',
    'site/index.md'                    : '# Luxout\n',
    'site/package.json'                : '{}\n',
    'src/a.ts'                         : "export const a = 1\nexport { page } from './ui/public/index.ts'\n",
    'src/b.ts'                         : 'export const b = 2\n',
    'src/package.json'                 : '{}\n',
    'src/tsconfig.json'                : '{}\n',
    'src/ui/public/index.ts'           : 'export const page = 4\n',
    'src/ui/public/tsconfig.json'      : '{}\n',
    'tests/a.test.ts'                  : "import { expect, test } from 'vitest'\n\n"
                                       + "import { a, page } from '../src/a.ts'\n\n"
                                       + "test('reads a', async () => {\n"
                                       + "  const { vet } = await import('../.mise/vet/index.ts')\n\n"
                                       + '  expect([a, vet, page]).toEqual([1, 3, 4])\n})\n',
    'tests/homebridge/bun.lock'        : '{}\n',
    'tests/homebridge/bunfig.toml'     : '{}\n',
    'tests/tsconfig.json'              : '{}\n',
    'tests/vet/floor/bun.lock'         : '{}\n',
    'tsconfig.json'                    : '{}\n',

    [`${STORE}/package.json`]  : '{ "exports": { "import": "./tsconfig.json" } }\n',
    [`${STORE}/tsconfig.json`] : '{}\n'
  })
  await mkdir(join(repo, '.mise', 'vet', 'node_modules', '@luxout'))
  await Promise.all([
    ...['.mise/lib/lock.sh', 'tests/common/triggers.ts', 'tests/coverage.json', 'tests/vitest.config.ts']
      .map((file) => cp(join(root, file), join(repo, file))),
    cp(join(import.meta.dirname, '..', '..', 'fixtures', 'mise.sh'), join(scratch, 'bin', 'mise')),
    symlink(join(repo, STORE), join(repo, '.mise', 'vet', 'node_modules', '@luxout', 'base')),
    symlink(join(root, 'node_modules'), join(repo, 'node_modules'))
  ])

  await branch(changed, repo, deleted)

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
  { changed: 'tsconfig.json', name: 'runs no plugin test', ran: false },
  { changed: 'src/a.ts', name: 'runs the plugin test', ran: true },
  { changed: '.mise/vet/bun.lock', name: 'runs every plugin test', ran: true },
  { changed: '.mise/vet/tsconfig.base.json', name: 'runs every plugin test', ran: true },
  { changed: '.mise/vet/tsconfig.empty.json', name: 'runs every plugin test', ran: true },
  { changed: '.mise/vet/tsconfig.json', name: 'runs every plugin test', ran: true },
  { changed: '.mise/vet/tsconfig.notes.json', name: 'runs every plugin test', ran: true },
  { changed: '.mise/vet/tsconfig.root.json', name: 'runs every plugin test', ran: true },
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
  { deleted: 'site/.vitepress/tsconfig.json', name: 'runs no plugin test', ran: false },
  { deleted: 'site/package.json', name: 'runs no plugin test', ran: false },
  { deleted: '.mise/vet/tsconfig.json', name: 'runs every plugin test', ran: true },
  { deleted: 'src/package.json', name: 'runs every plugin test', ran: true },
  { deleted: 'src/ui/public/tsconfig.json', name: 'runs every plugin test', ran: true },
  { deleted: 'tests/tsconfig.json', name: 'runs every plugin test', ran: true }
])(
  '$name where a branch deletes only $deleted',
  async ({ deleted, ran }, { scratch }) => {
    expect(await selected(deleted, scratch, true)).toEqual({ ran: ran, status: 0 })
    expect(existsSync(join(scratch, 'repo', deleted))).toBe(false)
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
    expect(await selected(changed, scratch, false, 'luxout (old)')).toEqual({ ran: ran, status: 0 })
  }
)
