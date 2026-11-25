/** @module-tag spawns */
import { existsSync } from 'node:fs'
import { join }       from 'node:path'

import { describe } from 'vitest'

import { ARGS, BASE, MERGE, affected, canned, reader } from '../../../common/affected.js'
import { test }                                        from '../../../common/scratch.js'
import { info }                                        from '../../../common/sync.js'

const PLUGIN = ['mise', 'run', 'plugin:test', '--', '--changed', BASE, ...ARGS]
const STORE  = '.mise/vet/node_modules/.bun/@luxout+base@1.0.0/node_modules/@luxout/base'
const VENDOR = '.mise/vet/vendor/node_modules/.bun/@luxout+vendored@1.0.0/node_modules/@luxout/vendored'

/**
 * Runs the task from a repository at `folder` under `scratch` whose branch
 * changes only `changed`, or deletes it where `deleted` is set, since it left
 * `origin/main`, where a stand-in `mise` runs each task file it names and
 * Vitest runs one plugin test under the suite's own configuration. The test
 * imports `src/a.ts`, which re-exports a module under `src/ui/public/`, and
 * imports `.mise/vet/index.ts` dynamically, whose tsconfig chain reaches a
 * package linked from a Bun isolated store, a linked directory, a link to a
 * package another `bun.lock` installs, an absolute path naming a directory
 * beside a `.json` file of the same name, and, through `..`, a directory whose
 * `package.json` names a `main`.
 * The `tsconfig.json` beside the module under `src/ui/public/` claims it
 * neither through the empty `files` its `extends` entry sets nor through its
 * one reference, so the transform applies `src/tsconfig.json`.
 */
function selected(
  changed : string,
  scratch : string,
  deleted = false,
  folder  = 'repo'
): ReturnType<typeof affected> {
  const repo     = join(scratch, folder)
  const checkout = {
    changed : changed,
    copied  : ['.mise/lib/lock.sh', 'tests/plugin/vitest.config.ts'],
    deleted : deleted,
    repo    : repo,
    scratch : scratch,
    task    : 'plugin:affected',
    linked  : {
      '.mise/vet/linked'                               : 'real',
      '.mise/vet/node_modules/@luxout/base'            : join(repo, STORE),
      '.mise/vet/vendor/node_modules/@luxout/vendored' : join(repo, VENDOR),
      '.mise/vet/vendored'                             : 'vendor/node_modules/@luxout/vendored'
    }
  }

  return affected(checkout, {
    '.gitignore'                       : '.cache\n.vitest\nnode_modules\n',
    '.mise/bun.lock'                   : '{}\n',
    '.mise/config.toml'                : '[tools]\n',
    '.mise/mise.lock'                  : '[tools]\n',
    '.mise/package.json'               : '{ "main": "vet/index.ts", "type": "module" }\n',
    '.mise/tsconfig.json'              : '{ "extends": "@luxout/plain" }\n',
    '.mise/vet/bun.lock'               : '{}\n',
    '.mise/vet/index.ts'               : 'export const vet = 3\n',
    '.mise/vet/real/tsconfig.json'     : '{}\n',
    '.mise/vet/shared.json'            : '{}\n',
    '.mise/vet/shared/tsconfig.json'   : '{}\n',
    '.mise/vet/tsconfig.base.json'     : `{ "extends": ["./tsconfig.root", "@luxout/base", "./linked", `
                                       + `"${repo}/.mise/vet/shared", "./vendored"] }\n`,
    '.mise/vet/tsconfig.empty.json'    : '',
    '.mise/vet/tsconfig.json'          : '{\n  // The vet suite\n  "extends": "./tsconfig.base.json"\n}\n',
    '.mise/vet/tsconfig.notes.json'    : '// The vet suite takes no option of its own\n',
    '.mise/vet/tsconfig.root.json'     : '\ufeff{ "extends": ["./tsconfig.empty.json", '
                                       + '"./tsconfig.notes.json", ".."], }\n',
    '.mise/vet/vendor/bun.lock'        : '{}\n',
    'bun.lock'                         : '{}\n',
    'package.json'                     : '{ "type": "module" }\n',
    'site/.vitepress/tsconfig.json'    : '{}\n',
    'site/.vitepress/vitest.config.ts' : '{}\n',
    'site/index.md'                    : '# Luxout\n',
    'src/a.ts'                         : "export const a = 1\nexport { page } from './ui/public/index.ts'\n",
    'src/b.ts'                         : 'export const b = 2\n',
    'src/package.json'                 : '{}\n',
    'src/tsconfig.json'                : '{}\n',
    'src/ui/public/files.json'         : '{ "files": [] }\n',
    'src/ui/public/index.ts'           : 'export const page = 4\n',
    'src/ui/public/page.json'          : '{ "include": ["page"] }\n',
    'src/ui/public/tsconfig.json'      : '{ "extends": "./files.json", '
                                       + '"references": [{ "path": "./page" }] }\n',
    'tests/plugin/a.test.ts'           : "import { expect, test } from 'vitest'\n\n"
                                       + "import { a, page } from '../../src/a.ts'\n\n"
                                       + "test('reads a', async () => {\n"
                                       + "  const { vet } = await import('../../.mise/vet/index.ts')\n\n"
                                       + '  expect([a, vet, page]).toEqual([1, 3, 4])\n})\n',
    'tests/plugin/homebridge/bun.lock' : '{}\n',
    'tests/plugin/tsconfig.json'       : '{}\n',
    'tests/plugin/vet/floor/bun.lock'  : '{}\n',
    'tests/site/a.test.ts'             : "import { expect, test } from 'vitest'\n\n"
                                       + "test('reads nothing', () => {\n  expect(1).toBe(1)\n})\n",
    'tests/site/tsconfig.json'         : '{}\n',
    'tsconfig.json'                    : '{}\n',

    '.mise/node_modules/@luxout/plain/package.json'  : '{}\n',
    '.mise/node_modules/@luxout/plain/tsconfig.json' : '{}\n',
    [`${STORE}/package.json`]                        : '{ "exports": { "import": "./tsconfig.json" } }\n',
    [`${STORE}/tsconfig.json`]                       : '{}\n',
    [`${VENDOR}/tsconfig.json`]                      : '{}\n'
  })
}

/**
 * Runs the task from a repository under `scratch` whose branch changes only
 * `changed`, where each of six plugin tests reads one file by path. Two spell
 * it through `join`, one through `new URL`, one through a task name, one
 * through a task file that sources it, and one through a glob a module it
 * imports holds.
 */
function read(changed: string, scratch: string): ReturnType<typeof affected> {
  const repo     = join(scratch, 'repo')
  const checkout = {
    changed : changed,
    copied  : ['.mise/lib/lock.sh', '.mise/tasks/repo/sync/labels', 'tests/plugin/vitest.config.ts'],
    linked  : {},
    repo    : repo,
    scratch : scratch,
    task    : 'plugin:affected'
  }

  return affected(checkout, {
    '.github/rulesets/main.json'       : '{}\n',
    '.github/rulesets/tags.json'       : '{}\n',
    '.github/workflows/ci.yml'         : 'on: pull_request\n',
    '.gitignore'                       : '.cache\nnode_modules\n',
    '.mise/lib/sync.sh'                : 'list_omitted() { :; }\n',
    '.mise/tasks/plugin/affected'      : '#!/usr/bin/env bash\n',
    'package.json'                     : '{ "type": "module" }\n',
    'src/ui/public/index.html'         : '<!doctype html>\n',
    'src/workflows.ts'                 : "import { globSync } from 'node:fs'\n\n"
                                       + "export const workflows = globSync('.github/workflows/*.yml')\n",
    'tests/plugin/fixture.test.ts'     : reader("join(import.meta.dirname, 'mise', 'fixtures', 'gh.sh')"),
    'tests/plugin/library.test.ts'     : reader("join('.mise', 'tasks', ...'repo:sync:labels'.split(':'))"),
    'tests/plugin/mise/fixtures/gh.sh' : '#!/bin/sh\n',
    'tests/plugin/page.test.ts'        : reader("join('src', 'ui', 'public', 'index.html')"),
    'tests/plugin/ruleset.test.ts'     : reader(
      "new URL('../../.github/rulesets/main.json', import.meta.url)"
    ),
    'tests/plugin/task.test.ts'        : reader("join('.mise', 'tasks', ...'plugin:affected'.split(':'))"),
    'tests/plugin/workflow.test.ts'    : "import { expect, test } from 'vitest'\n\n"
                                       + "import { workflows } from '../../src/workflows.ts'\n\n"
                                       + "test('reads the workflows', () => {\n"
                                       + "  expect(workflows).toHaveLength(1)\n})\n"
  })
}

describe.concurrent('plugin:affected', () => {
  test('takes the alias affected', async ({ expect }) => {
    expect(await info('plugin:affected')).toMatchObject({ aliases: ['affected'] })
  })

  test('runs plugin:test against the merge base, passing every further argument to Vitest', async ({
    expect,
    scratch
  }) => {
    expect(await canned(scratch, PLUGIN, 'plugin:affected'))
      .toMatchObject({ commands: [MERGE, PLUGIN], status: 0 })
  })

  test.for([
    { commands: [MERGE], failing: MERGE, name: '`git merge-base`' },
    { commands: [MERGE, PLUGIN], failing: PLUGIN, name: '`plugin:test`' }
  ])('fails once $name fails', async ({ commands, failing }, { expect, scratch }) => {
    expect(await canned(scratch, PLUGIN, 'plugin:affected', failing)).toMatchObject({ commands, status: 1 })
  })

  test.for([
    { changed: '.mise/vet/shared.json', name: 'runs no plugin test', ran: false },
    { changed: 'site/.vitepress/tsconfig.json', name: 'runs no plugin test', ran: false },
    { changed: 'site/index.md', name: 'runs no plugin test', ran: false },
    { changed: 'src/b.ts', name: 'runs no plugin test', ran: false },
    { changed: 'tests/site/a.test.ts', name: 'runs no plugin test', ran: false },
    { changed: 'tests/site/tsconfig.json', name: 'runs no plugin test', ran: false },
    { changed: 'tsconfig.json', name: 'runs no plugin test', ran: false },
    { changed: 'src/a.ts', name: 'runs the plugin test', ran: true },
    { changed: '.mise/bun.lock', name: 'runs every plugin test', ran: true },
    { changed: '.mise/config.toml', name: 'runs every plugin test', ran: true },
    { changed: '.mise/mise.lock', name: 'runs every plugin test', ran: true },
    { changed: '.mise/tsconfig.json', name: 'runs every plugin test', ran: true },
    { changed: '.mise/vet/bun.lock', name: 'runs every plugin test', ran: true },
    { changed: '.mise/vet/real/tsconfig.json', name: 'runs every plugin test', ran: true },
    { changed: '.mise/vet/shared/tsconfig.json', name: 'runs every plugin test', ran: true },
    { changed: '.mise/vet/tsconfig.base.json', name: 'runs every plugin test', ran: true },
    { changed: '.mise/vet/tsconfig.empty.json', name: 'runs every plugin test', ran: true },
    { changed: '.mise/vet/tsconfig.json', name: 'runs every plugin test', ran: true },
    { changed: '.mise/vet/tsconfig.notes.json', name: 'runs every plugin test', ran: true },
    { changed: '.mise/vet/tsconfig.root.json', name: 'runs every plugin test', ran: true },
    { changed: '.mise/vet/vendor/bun.lock', name: 'runs every plugin test', ran: true },
    { changed: 'bun.lock', name: 'runs every plugin test', ran: true },
    { changed: 'package.json', name: 'runs every plugin test', ran: true },
    { changed: 'src/package.json', name: 'runs every plugin test', ran: true },
    { changed: 'site/.vitepress/vitest.config.ts', name: 'runs every plugin test', ran: true },
    { changed: 'src/tsconfig.json', name: 'runs every plugin test', ran: true },
    { changed: 'src/ui/public/files.json', name: 'runs every plugin test', ran: true },
    { changed: 'src/ui/public/page.json', name: 'runs every plugin test', ran: true },
    { changed: 'src/ui/public/tsconfig.json', name: 'runs every plugin test', ran: true },
    { changed: 'tests/plugin/homebridge/bun.lock', name: 'runs every plugin test', ran: true },
    { changed: 'tests/plugin/tsconfig.json', name: 'runs every plugin test', ran: true },
    { changed: 'tests/plugin/vet/floor/bun.lock', name: 'runs every plugin test', ran: true },
    { changed: 'tests/plugin/vitest.config.ts', name: 'runs every plugin test', ran: true }
  ])('$name where a branch changes only $changed', async ({ changed, ran }, { expect, scratch }) => {
    expect(await selected(changed, scratch)).toEqual({ ran, status: 0 })
  })

  test.for([
    { deleted: 'site/.vitepress/tsconfig.json', name: 'runs no plugin test', ran: false },
    { deleted: 'tests/site/tsconfig.json', name: 'runs no plugin test', ran: false },
    { deleted: '.mise/vet/tsconfig.json', name: 'runs every plugin test', ran: true },
    { deleted: 'src/package.json', name: 'runs every plugin test', ran: true },
    { deleted: 'src/ui/public/tsconfig.json', name: 'runs every plugin test', ran: true },
    { deleted: 'tests/plugin/tsconfig.json', name: 'runs every plugin test', ran: true }
  ])('$name where a branch deletes only $deleted', async ({ deleted, ran }, { expect, scratch }) => {
    expect(await selected(deleted, scratch, true)).toEqual({ ran, status: 0 })
    expect(existsSync(join(scratch, 'repo', deleted))).toBe(false)
  })

  test.for([
    { changed: '.github/rulesets/tags.json', name: 'runs no plugin test', ran: false },
    { changed: '.github/rulesets/main.json', name: 'runs only the plugin test reading it', ran: true },
    { changed: '.github/workflows/ci.yml', name: 'runs only the plugin test reading it', ran: true },
    { changed: '.mise/lib/sync.sh', name: 'runs only the plugin test reading it', ran: true },
    { changed: '.mise/tasks/plugin/affected', name: 'runs only the plugin test reading it', ran: true },
    { changed: 'src/ui/public/index.html', name: 'runs only the plugin test reading it', ran: true },
    { changed: 'tests/plugin/mise/fixtures/gh.sh', name: 'runs only the plugin test reading it', ran: true }
  ])(
    '$name by path where a branch changes only $changed',
    async ({ changed, ran }, { expect, scratch }) => {
      expect(await read(changed, scratch)).toEqual({ ran, status: 0 })
    }
  )

  test.for([
    { changed: 'tests/site/a.test.ts', name: 'runs no plugin test', ran: false },
    { changed: 'tests/site/tsconfig.json', name: 'runs no plugin test', ran: false },
    { changed: '.mise/config.toml', name: 'runs every plugin test', ran: true },
    { changed: '.mise/mise.lock', name: 'runs every plugin test', ran: true },
    { changed: '.mise/vet/tsconfig.json', name: 'runs every plugin test', ran: true },
    { changed: 'bun.lock', name: 'runs every plugin test', ran: true },
    { changed: 'package.json', name: 'runs every plugin test', ran: true },
    { changed: 'src/package.json', name: 'runs every plugin test', ran: true }
  ])(
    '$name where a branch changes only $changed in a checkout under luxout (old)',
    async ({ changed, ran }, { expect, scratch }) => {
      expect(await selected(changed, scratch, false, 'luxout (old)')).toEqual({ ran, status: 0 })
    }
  )
})
