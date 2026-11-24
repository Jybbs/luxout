/** @module-tag spawns */
import { existsSync } from 'node:fs'
import { join }       from 'node:path'

import { describe } from 'vitest'

import { ARGS, BASE, MERGE, affected, canned, reader } from '../../../common/affected.js'
import { test }                                        from '../../../common/scratch.js'

/**
 * Two site tests, one listing the Markdown files of `guide/` through a module
 * calling `readdirSync`, the other listing its own folder through `readdir`
 * and naming no Markdown file.
 */
const LISTED_PAGES = {
  'site/.vitepress/lib/list.ts' : "import { readdirSync } from 'node:fs'\n\n"
                                + 'export const list = (dir: string): string[] => '
                                + "readdirSync(dir).filter((name) => name.endsWith('.md'))\n",
  'tests/site/list.test.ts'     : "import { join } from 'node:path'\n\n"
                                + "import { expect, test } from 'vitest'\n\n"
                                + "import { list } from '../../site/.vitepress/lib/list.ts'\n\n"
                                + "test('lists the guide', () => {\n"
                                + "  expect(list(join(import.meta.dirname, '..', '..', 'site', 'guide')))"
                                + '.toBeInstanceOf(Array)\n})\n',
  'tests/site/other.test.ts'    : "import { readdir } from 'node:fs/promises'\n\n"
                                + "import { expect, test } from 'vitest'\n\n"
                                + "test('lists the tests', async () => {\n"
                                + '  await expect(readdir(import.meta.dirname))'
                                + ".resolves.toContain('other.test.ts')\n})\n"
}
/**
 * A site test reading each page VitePress resolves through `resolveConfig`.
 */
const RESOLVED_PAGES = {
  'tests/site/site.test.ts' : "import { readFileSync } from 'node:fs'\n"
                            + "import { join } from 'node:path'\n\n"
                            + "import { resolveConfig } from 'vitepress'\n"
                            + "import { expect, test } from 'vitest'\n\n"
                            + "const site = join(import.meta.dirname, '..', '..', 'site')\n\n"
                            + "test('reads the pages', async () => {\n"
                            + '  const { pages, srcDir } = '
                            + "await resolveConfig(site, 'build')\n\n"
                            + '  expect(pages.map((page) => readFileSync(join(srcDir, page), '
                            + "'utf8'))).not.toContain('')\n})\n"
}
const SITE = ['mise', 'run', 'site:test', '--', '--changed', BASE, ...ARGS]

/**
 * Runs the task from the site of a repository at `folder` under `scratch`
 * whose branch changes only `changed`, or deletes it where `deleted` is set,
 * since it left `origin/main`, where a stand-in `mise` runs each task file it
 * names and Vitest runs one site test, which imports `.vitepress/lib/a.ts` and
 * a module beside each `tsconfig.json` under `src/`, one of them importing a
 * package from the root `node_modules`, under the site suite's own
 * configuration.
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
    copied  : ['site/.vitepress/vitest.config.ts'],
    cwd     : join(repo, 'site'),
    deleted : deleted,
    linked  : {},
    repo    : repo,
    scratch : scratch,
    task    : 'site:affected'
  }

  return affected(checkout, {
    '.gitignore'                       : '.cache\nnode_modules\n',
    '.mise/config.toml'                : '[tools]\n',
    '.mise/mise.lock'                  : '[tools]\n',
    'bun.lock'                         : '{}\n',
    'package.json'                     : '{ "type": "module" }\n',
    'site/.vitepress/lib/a.ts'         : 'export const a = 1\n',
    'site/.vitepress/lib/b.ts'         : 'export const b = 2\n',
    'site/.vitepress/tsconfig.json'    : '{}\n',
    'src/a.ts'                         : 'export const a = 1\n',
    'src/b.ts'                         : "import { Body } from 'astronomy-engine'\n\n"
                                       + 'export const b = Body.Sun\n',
    'src/tsconfig.json'                : '{}\n',
    'src/ui/public/files.json'         : '{ "files": [] }\n',
    'src/ui/public/index.ts'           : 'export const page = 4\n',
    'src/ui/public/page.json'          : '{ "include": ["page"] }\n',
    'src/ui/public/tsconfig.json'      : '{ "extends": "./files.json", '
                                       + '"references": [{ "path": "./page" }] }\n',
    'tests/plugin/homebridge/bun.lock' : '{}\n',
    'tests/plugin/tsconfig.json'       : '{}\n',
    'tests/site/a.test.ts'             : "import { expect, test } from 'vitest'\n\n"
                                       + "import { a } from '../../site/.vitepress/lib/a.ts'\n"
                                       + "import { b } from '../../src/b.ts'\n"
                                       + "import { page } from '../../src/ui/public/index.ts'\n\n"
                                       + "test('reads a', () => {\n"
                                       + "  expect([a, b, page]).toEqual([1, 'Sun', 4])\n})\n",
    'tests/site/tsconfig.json'         : '{}\n'
  })
}

/**
 * Runs the task from the site of a repository under `scratch` whose branch
 * changes only `changed`, or deletes it where `deleted` is set, where the site
 * holds the `readers` files, each reading its pages while spelling no page
 * path, and the site's `srcExclude` leaves out `drafts/`.
 */
function paged(
  changed : string,
  deleted : boolean,
  readers : Record<string, string>,
  scratch : string
): ReturnType<typeof affected> {
  return run(changed, {
    ...readers,
    '.gitignore'                : '.cache\nnode_modules\n',
    'package.json'              : '{ "type": "module" }\n',
    'site/.vitepress/config.ts' : "export default { srcExclude: ['drafts/**'] }\n",
    'site/drafts/note.md'       : '# Note\n',
    'site/guide/install.md'     : '# Install\n'
  }, scratch, deleted)
}

/**
 * Runs the task from the site of a repository under `scratch` whose branch
 * changes only `changed`, where each of five site tests reads one file by
 * path. Two spell it through `new URL`, one through `join`, one through a
 * glob, and one through a glob a module it imports holds.
 */
function read(changed: string, scratch: string): ReturnType<typeof affected> {
  return run(changed, {
    '.github/README.md'                : '# Luxout\n',
    '.gitignore'                       : '.cache\nnode_modules\n',
    'package.json'                     : '{ "type": "module" }\n',
    'site/.vitepress/lib/pages.ts'     : "import { globSync } from 'node:fs'\n\n"
                                       + "export const pages = globSync('guide/*.md')\n",
    'site/.vitepress/theme/tokens.css' : ':root {}\n',
    'site/estimate/day.svg'            : '<svg/>\n',
    'site/estimate/sun-path.svg'       : '<svg/>\n',
    'site/guide/install.md'            : '# Install\n',
    'site/references.bib'              : '@misc{a,}\n',
    'tests/site/bib.test.ts'           : reader("new URL('../../site/references.bib', import.meta.url)"),
    'tests/site/doc.test.ts'           : reader("new URL('../../.github/README.md', import.meta.url)"),
    'tests/site/pages.test.ts'         : "import { expect, test } from 'vitest'\n\n"
                                       + "import { pages } from '../../site/.vitepress/lib/pages.ts'\n\n"
                                       + "test('reads the pages', () => {\n"
                                       + "  expect(pages).toHaveLength(1)\n})\n",
    'tests/site/sheet.test.ts'         : reader("globSync('.vitepress/theme/*.css')[0]"),
    'tests/site/svg.test.ts'           : reader("join('estimate', 'sun-path.svg')")
  }, scratch)
}

/**
 * Runs the task from the site of a repository under `scratch` holding the
 * `planted` files, whose branch changes only `changed`, or deletes it where
 * `deleted` is set.
 */
function run(
  changed : string,
  planted : Record<string, string>,
  scratch : string,
  deleted = false
): ReturnType<typeof affected> {
  const repo     = join(scratch, 'repo')
  const checkout = {
    changed : changed,
    copied  : ['site/.vitepress/vitest.config.ts'],
    cwd     : join(repo, 'site'),
    deleted : deleted,
    linked  : {},
    repo    : repo,
    scratch : scratch,
    task    : 'site:affected'
  }

  return affected(checkout, planted)
}

describe.concurrent('site:affected', () => {
  test('runs site:test against the merge base, passing every further argument to Vitest', async ({
    expect,
    scratch
  }) => {
    expect(await canned(scratch, SITE, 'site:affected')).toMatchObject({ commands: [MERGE, SITE], status: 0 })
  })

  test.for([
    { commands: [MERGE], failing: MERGE, name: '`git merge-base`' },
    { commands: [MERGE, SITE], failing: SITE, name: '`site:test`' }
  ])('fails once $name fails', async ({ commands, failing }, { expect, scratch }) => {
    expect(await canned(scratch, SITE, 'site:affected', failing)).toMatchObject({ commands, status: 1 })
  })

  test.for([
    { changed: 'site/.vitepress/lib/b.ts', name: 'runs no site test', ran: false },
    { changed: 'src/a.ts', name: 'runs no site test', ran: false },
    { changed: 'tests/plugin/homebridge/bun.lock', name: 'runs no site test', ran: false },
    { changed: 'tests/plugin/tsconfig.json', name: 'runs no site test', ran: false },
    { changed: 'site/.vitepress/lib/a.ts', name: 'runs the site test', ran: true },
    { changed: '.mise/config.toml', name: 'runs every site test', ran: true },
    { changed: '.mise/mise.lock', name: 'runs every site test', ran: true },
    { changed: 'bun.lock', name: 'runs every site test', ran: true },
    { changed: 'package.json', name: 'runs every site test', ran: true },
    { changed: 'site/.vitepress/tsconfig.json', name: 'runs every site test', ran: true },
    { changed: 'site/.vitepress/vitest.config.ts', name: 'runs every site test', ran: true },
    { changed: 'src/tsconfig.json', name: 'runs every site test', ran: true },
    { changed: 'src/ui/public/files.json', name: 'runs every site test', ran: true },
    { changed: 'src/ui/public/page.json', name: 'runs every site test', ran: true },
    { changed: 'src/ui/public/tsconfig.json', name: 'runs every site test', ran: true },
    { changed: 'tests/site/tsconfig.json', name: 'runs every site test', ran: true }
  ])('$name where a branch changes only $changed', async ({ changed, ran }, { expect, scratch }) => {
    expect(await selected(changed, scratch)).toEqual({ ran, status: 0 })
  })

  test.for([
    { changed: 'site/estimate/day.svg', name: 'runs no site test', ran: false },
    { changed: '.github/README.md', name: 'runs only the site test reading it', ran: true },
    { changed: 'site/.vitepress/theme/tokens.css', name: 'runs only the site test reading it', ran: true },
    { changed: 'site/estimate/sun-path.svg', name: 'runs only the site test reading it', ran: true },
    { changed: 'site/guide/install.md', name: 'runs only the site test reading it', ran: true },
    { changed: 'site/references.bib', name: 'runs only the site test reading it', ran: true }
  ])(
    '$name by path where a branch changes only $changed',
    async ({ changed, ran }, { expect, scratch }) => {
      expect(await read(changed, scratch)).toEqual({ ran, status: 0 })
    }
  )

  test.for([
    { changed: 'site/drafts/note.md', name: 'runs no site test', ran: false },
    { changed: 'site/guide/install.md', name: 'runs the site test reading it', ran: true }
  ].flatMap((row) => Object.entries({ changes: false, deletes: true }).flatMap(([verb, deleted]) => [
    { ...row, deleted, readers: RESOLVED_PAGES, through: 'VitePress', verb },
    { ...row, deleted, readers: LISTED_PAGES, through: 'a folder listing', verb }
  ])))(
    '$name through $through where a branch $verb only $changed',
    async ({ changed, deleted, ran, readers }, { expect, scratch }) => {
      expect(await paged(changed, deleted, readers, scratch)).toEqual({ ran, status: 0 })
    }
  )

  test.for([
    { deleted: 'tests/plugin/tsconfig.json', name: 'runs no site test', ran: false },
    { deleted: 'site/.vitepress/tsconfig.json', name: 'runs every site test', ran: true },
    { deleted: 'src/ui/public/tsconfig.json', name: 'runs every site test', ran: true },
    { deleted: 'tests/site/tsconfig.json', name: 'runs every site test', ran: true }
  ])('$name where a branch deletes only $deleted', async ({ deleted, ran }, { expect, scratch }) => {
    expect(await selected(deleted, scratch, true)).toEqual({ ran, status: 0 })
    expect(existsSync(join(scratch, 'repo', deleted))).toBe(false)
  })

  test.for([
    { changed: 'tests/plugin/homebridge/bun.lock', name: 'runs no site test', ran: false },
    { changed: '.mise/config.toml', name: 'runs every site test', ran: true },
    { changed: '.mise/mise.lock', name: 'runs every site test', ran: true },
    { changed: 'bun.lock', name: 'runs every site test', ran: true },
    { changed: 'package.json', name: 'runs every site test', ran: true },
    { changed: 'site/.vitepress/tsconfig.json', name: 'runs every site test', ran: true },
    { changed: 'site/.vitepress/vitest.config.ts', name: 'runs every site test', ran: true },
    { changed: 'src/tsconfig.json', name: 'runs every site test', ran: true },
    { changed: 'src/ui/public/tsconfig.json', name: 'runs every site test', ran: true },
    { changed: 'tests/site/tsconfig.json', name: 'runs every site test', ran: true }
  ])(
    '$name where a branch changes only $changed in a checkout under luxout (old)',
    async ({ changed, ran }, { expect, scratch }) => {
      expect(await selected(changed, scratch, false, 'luxout (old)')).toEqual({ ran, status: 0 })
    }
  )
})
