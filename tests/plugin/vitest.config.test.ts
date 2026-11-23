/** @module-tag spawns */
import { existsSync, readFileSync }                   from 'node:fs'
import { appendFile, chmod, glob, readFile, symlink } from 'node:fs/promises'
import { dirname, join, parse, relative, sep }        from 'node:path'

import type * as Experimental from 'rolldown/experimental'
import type * as Utils        from 'rolldown/utils'
import { expect, it, vi }     from 'vitest'
import { defaultExclude }     from 'vitest/config'

import { branch }                                 from './common/repository.js'
import { plant, test }                            from './common/scratch.js'
import { changedFiles, requests, triggers, vite } from './common/triggers.js'
import config                                     from './vitest.config.js'

const BRANCHES   = { changes: false, deletes: true }
const PAGED      = ['.vitepress/tests/*.test.ts', 'outside.test.ts']
const PAGE_TESTS = [
  '.vitepress/tests/glob.test.ts', '.vitepress/tests/helper.test.ts', '.vitepress/tests/list.test.ts',
  '.vitepress/tests/own.test.ts', '.vitepress/tests/read.test.ts', '.vitepress/tests/shelf.test.ts',
  '.vitepress/tests/site.test.ts', '.vitepress/tests/sorted.test.ts', '.vitepress/tests/whole.test.ts'
]
const SCRIPT     = /\.[cm]?[jt]sx?$/
const pragma     = /(?:\/\/|\*)\s*@module-tag\s+[\w\-/]+/
const root       = dirname(import.meta.dirname)
const files      = glob(config.test?.include ?? [], { cwd: root, exclude: defaultExclude })
const sources    = await Array.fromAsync(files, async (file) => ({
  file : file,
  text : await readFile(join(root, file), 'utf8')
}))
const { ResolverFactory, resolveTsconfig } = vite(root)('rolldown/experimental') as typeof Experimental
const { parseSync } = vite(root)('rolldown/utils') as typeof Utils
const resolver      = new ResolverFactory({ extensionAlias: { '.js': ['.ts', '.js'] } })
const spawning      = sources.filter(({ file }) => derived(file, root))

/**
 * Plants a repository at `scratch` whose branch changes only `changed` since
 * `origin/main`. Each test file in it spells at most one path or glob,
 * `part.test.ts` beside a part of a template naming `drafts`, and
 * `load.test.ts` imports `lib/load.ts` through a template holding no
 * substitution. `bin/tool` is a program that sources `lib/a.sh`, `lib/a.sh`
 * sources `lib/b.sh`, and `bin/each` reads `logs/` through a glob.
 */
async function checkout(changed: string, scratch: string): Promise<void> {
  await plant(scratch, {
    '.gitignore'        : 'node_modules\n',
    'art/day-frame.css' : ':root {}\n',
    'bin/each'          : '#!/bin/sh\ncat logs/*.txt\n',
    'bin/tool'          : '#!/bin/sh\n. lib/a.sh\n',
    'cfg/package.json'  : '{}\n',
    'dir.test.ts'       : "export const dir = join('docs', 'guide')\n",
    'docs/guide/a.md'   : '# A\n',
    'drafts/a.md'       : '# A\n',
    'each.test.ts'      : "export const each = 'bin/each'\n",
    'frame.test.ts'     : 'export const frame = (name: string): string => `art/${name}-frame.css`\n',
    'glob.test.ts'      : "export const all = '*.md'\n",
    'lib/a.sh'          : '. lib/b.sh\n',
    'lib/b.sh'          : ':\n',
    'lib/load.ts'       : "export const shared = 'share/a.txt'\n",
    'load.test.ts'      : 'export const load = import(`./lib/load.js`)\n',
    'logs/a.txt'        : 'a\n',
    'misc.md'           : '# Misc\n',
    'nest.test.ts'      : "export const nest = '*/b.md'\n",
    'notes/a.md'        : '# A\n',
    'pages.test.ts'     : "export const pages = ['../pages', '*.md']\n",
    'pages/b.md'        : '# B\n',
    'part.test.ts'      : "export const part = (sep: string): string[] => [`${sep}drafts${sep}`, '*.md']\n",
    'share/a.txt'       : 'a\n',
    'source.test.ts'    : "import './package.json'\nexport * from '../package.json'\n"
                        + "export { name } from './cfg/package.json'\n"
                        + "export const read = import('./cfg/package.json')\n",
    'tasks/labels'      : ':\n',
    'tool.test.ts'      : "export const tool = 'bin/tool'\n",
    'var.test.ts'       : "export const note = '$ROOT/notes/a.md'\n",
    'wide.test.ts'      : "export const wide = (a: string, b: string): string[] => "
                        + "['art', `${a}-frame.css`, `${a}/${b}`, `./${a}.css`]\n",
    'word.test.ts'      : "export const word = 'labels'\n"
  })
  await Promise.all([
    chmod(join(scratch, 'bin', 'each'), 0o755),
    chmod(join(scratch, 'bin', 'tool'), 0o755),
    symlink(join(root, 'node_modules'), join(scratch, 'node_modules'))
  ])
  await branch(changed, scratch)
}

/**
 * Reports whether the test file at `file` under `root` runs a child process,
 * in that it imports `node:child_process` or a module under
 * `tests/plugin/common/` that does, per `spawns`.
 */
function derived(file: string, root: string): boolean {
  const common = join(root, 'tests', 'plugin', 'common', '')

  return spawns(join(root, file), (path) => path.startsWith(common))
}

/**
 * Reports whether `path` names a script outside `node_modules`.
 */
function local(path: string): boolean {
  return SCRIPT.test(path) && !path.includes(`${sep}node_modules${sep}`)
}

/**
 * Lists, relative to `scratch`, the files `changedFiles` gives a run there
 * that reads each change since `changedSince`, among the test files `include`
 * matches.
 */
async function provided(scratch: string, changedSince?: string, include = ['*.test.ts']): Promise<string[]> {
  const files = await changedFiles(include).findChangedFiles({
    changedSince : changedSince,
    resolver     : { getDependencies: () => Promise.resolve([]) },
    root         : scratch
  })

  return files.map((file) => relative(scratch, file))
}

/**
 * Plants a VitePress site at `scratch` whose branch changes only `changed`, or
 * deletes it where `deleted` is set, linking `modules`, where given, as its
 * `node_modules`. Its config sets `srcDir` to `pages`, whose `drafts/` its
 * `srcExclude` leaves out, as VitePress leaves out its `dist/`. Two site tests
 * call `resolveConfig`, one through a module it imports, a third imports
 * another export of `vitepress`, a fourth imports the `resolveConfig` of
 * `vite`, and a test outside `.vitepress` calls `resolveConfig` too. Five more
 * site tests each import an export listing Markdown files, through
 * `readdirSync`, through `globSync`, through the `readdir` of
 * `node:fs/promises`, through a local helper calling `readdirSync`, and through
 * an object holding such a helper as a shorthand property, a sixth lists them
 * in its own body, and a seventh imports the whole of `list.ts`. Others import
 * the named and default exports `list.ts` declares ahead of its listing helper,
 * reading one named page, import an export listing a folder through `readdir`
 * naming no Markdown file, directly or re-exported beside a listing declaration
 * of the same name, import exports reading only members and keys that share the
 * name of a listing declaration, or name every Markdown file in one statement
 * while listing a folder in another, and `notes.md` sits outside `srcDir`.
 */
async function site(
  changed : string,
  modules : string | undefined,
  scratch : string,
  deleted = false
): Promise<void> {
  await plant(scratch, {
    '.gitignore'                      : 'node_modules\n',
    '.vitepress/config.ts'            : "export default { srcDir: 'pages', srcExclude: ['drafts/**'] }\n",
    '.vitepress/lib/cards.ts'         : "import { readdir } from 'node:fs/promises'\n"
                                      + "export const cards = (): Promise<string[]> => readdir('cards')\n",
    '.vitepress/lib/glob.ts'          : "import { globSync } from 'node:fs'\n"
                                      + 'export const glob = (cwd: string): string[] => '
                                      + "globSync('**/*.md', { cwd })\n",
    '.vitepress/lib/list.ts'          : "import { readFileSync, readdirSync } from 'node:fs'\n"
                                      + 'export const title = (name: string): string => '
                                      + "readFileSync(`${name}.md`, 'utf8')\n"
                                      + 'const list = (dir: string): string[] => '
                                      + "readdirSync(dir).filter((name) => name.endsWith('.md'))\n"
                                      + 'export { list }\n'
                                      + 'export default title\n',
    '.vitepress/lib/order.ts'         : "import { readdirSync } from 'node:fs'\n"
                                      + 'const list = (dir: string): string[] => readdirSync(dir)\n'
                                      + 'export const sorted = (dir: string): string[] => '
                                      + "list(dir).filter((name) => name.endsWith('.md')).sort()\n",
    '.vitepress/lib/pages.ts'         : "import { resolveConfig } from 'vitepress'\n"
                                      + 'export const pages = resolveConfig\n',
    '.vitepress/lib/prop.ts'          : "import { readdirSync } from 'node:fs'\n"
                                      + 'const pages = (dir: string): string[] => '
                                      + "readdirSync(dir).filter((name) => name.endsWith('.md'))\n"
                                      + 'export const count = (o: { pages: string[] }): number => '
                                      + 'o.pages.length + { pages: 0 }.pages\n'
                                      + 'export class Deck { pages = 0; '
                                      + 'static pages(): number { return 0 } }\n'
                                      + 'export const shelf = { pages }\n',
    '.vitepress/lib/read.ts'          : "import { readdir } from 'node:fs/promises'\n"
                                      + 'export const read = async (dir: string): Promise<string[]> => '
                                      + "(await readdir(dir)).filter((name) => name.endsWith('.md'))\n",
    '.vitepress/lib/shadow.ts'        : "import { readdirSync } from 'node:fs'\n"
                                      + 'const cards = (dir: string): string[] => '
                                      + "readdirSync(dir).filter((name) => name.endsWith('.md'))\n"
                                      + "export { cards } from './cards.ts'\n",
    '.vitepress/tests/bundle.test.ts' : "import { resolveConfig } from 'vite'\n"
                                      + 'export const bundle = resolveConfig\n',
    '.vitepress/tests/cards.test.ts'  : "export { cards } from '../lib/cards.ts'\n",
    '.vitepress/tests/glob.test.ts'   : "export { glob } from '../lib/glob.ts'\n",
    '.vitepress/tests/helper.test.ts' : "export { pages } from '../lib/pages.ts'\n",
    '.vitepress/tests/lede.test.ts'   : "import lede from '../lib/list.ts'\n"
                                      + 'export const opening = lede\n',
    '.vitepress/tests/list.test.ts'   : "export { list } from '../lib/list.ts'\n",
    '.vitepress/tests/names.test.ts'  : "import { readdirSync } from 'node:fs'\n"
                                      + "export const names = '*.md'\n"
                                      + "export const cards = readdirSync('cards')\n",
    '.vitepress/tests/own.test.ts'    : "import { readdirSync } from 'node:fs'\n"
                                      + "readdirSync('.').filter((name) => name.endsWith('.md'))\n",
    '.vitepress/tests/prop.test.ts'   : "export { Deck, count } from '../lib/prop.ts'\n",
    '.vitepress/tests/read.test.ts'   : "export { read } from '../lib/read.ts'\n",
    '.vitepress/tests/render.test.ts' : "import { createMarkdownRenderer } from 'vitepress'\n"
                                      + 'export const render = createMarkdownRenderer\n',
    '.vitepress/tests/shadow.test.ts' : "import { cards } from '../lib/shadow.ts'\n"
                                      + 'export const deck = cards\n',
    '.vitepress/tests/shelf.test.ts'  : "export { shelf } from '../lib/prop.ts'\n",
    '.vitepress/tests/site.test.ts'   : "import { resolveConfig } from 'vitepress'\n"
                                      + 'export const site = resolveConfig\n',
    '.vitepress/tests/sorted.test.ts' : "export { sorted } from '../lib/order.ts'\n",
    '.vitepress/tests/title.test.ts'  : "import { title } from '../lib/list.ts'\n"
                                      + 'export const named = title\n',
    '.vitepress/tests/whole.test.ts'  : "import * as list from '../lib/list.ts'\n"
                                      + 'export const whole = list\n',
    'notes.md'                        : '# Notes\n',
    'notes.txt'                       : 'A\n',
    'outside.test.ts'                 : "import { resolveConfig } from 'vitepress'\n"
                                      + 'export const outside = resolveConfig\n',
    'package.json'                    : '{ "type": "module" }\n',
    'pages/dist/a.md'                 : '# A\n',
    'pages/drafts/a.md'               : '# A\n',
    'pages/guide/a.md'                : '# A\n'
  })
  if (modules) await symlink(modules, join(scratch, 'node_modules'))
  await branch(changed, scratch, deleted)
}

/**
 * Reports whether `file` imports `node:child_process`, or a module that
 * `follows` accepts and that does, following each import of such a module
 * into every script outside `node_modules`.
 */
function spawns(file: string, follows: (path: string) => boolean, seen = new Set([file])): boolean {
  const text = readFileSync(file, 'utf8')

  return requests(parseSync(file, text).module, text).some(([request]) => {
    if (request === 'node:child_process') {
      return true
    }

    const { path } = resolver.sync(dirname(file), request)

    return path !== undefined && follows(path) && !seen.has(path) && spawns(path, local, seen.add(path))
  })
}

it('fails a case with no assertion, shuffles the order, and undoes every spy and stub', () => {
  expect(config.test).toMatchObject({
    expect        : { requireAssertions: true },
    restoreMocks  : true,
    sequence      : { shuffle: true },
    unstubEnvs    : true,
    unstubGlobals : true
  })
})

it('measures coverage over .mise/**/*.ts and src/**/*.ts and reports it under .cache/coverage', () => {
  expect(config.test?.coverage).toMatchObject({
    include          : ['.mise/**/*.ts', 'src/**/*.ts'],
    reportsDirectory : '.cache/coverage'
  })
})

it('keeps the Vite and Vitest caches under .cache/vite', () => {
  expect(config.cacheDir).toBe('.cache/vite')
})

it('keeps the module cache under .cache/vitest rather than a node_modules a checkout links', () => {
  expect(config.test?.fsModuleCachePath).toBe('.cache/vitest')
})

it('reruns every test after a change to the runtime pins or a file read beside the imported modules', () => {
  const triggers = config.test?.forceRerunTriggers?.filter(existsSync).map((file) => relative(root, file))

  expect(new Set(triggers)).toEqual(new Set([
    '.mise/audit/tsconfig.json', '.mise/config.toml', '.mise/mise.lock', '.mise/vet/tsconfig.json',
    'bun.lock', 'package.json', 'site/.vitepress/vitest.config.ts', 'src/tsconfig.json',
    'src/ui/public/tsconfig.json', 'tests/plugin/common/triggers.ts', 'tests/plugin/homebridge/bun.lock',
    'tests/plugin/tsconfig.json', 'tests/plugin/vet/floor/bun.lock', 'tests/plugin/vet/pinned/bun.lock',
    'tests/plugin/vitest.config.ts'
  ]))
})

it.each(['.', 'site'])(
  'reads each tsconfig of the suite under %s through the rolldown the root install’s Vite loads',
  (dir) => {
    expect(vite(join(root, dir)).resolve('rolldown/package.json'))
      .toBe(join(root, 'node_modules', 'rolldown', 'package.json'))
  }
)

it('compiles every test file under tests/plugin/tsconfig.json in the transform Vite applies', () => {
  const tsconfig = join(root, 'tests', 'plugin', 'tsconfig.json')
  const stray    = sources.filter(({ file }) =>
    resolveTsconfig(join(root, file))?.tsconfigFilePaths[0] !== tsconfig
  )

  expect(stray.map(({ file }) => file)).toEqual([])
})

test(
  'resolves rolldown beside the Vite that Vitest loads, ahead of each copy nearer the root',
  async ({ scratch }) => {
    const nested = 'node_modules/vitest/node_modules/vite/node_modules/rolldown/package.json'

    await plant(scratch, Object.fromEntries([
      'node_modules/rolldown/package.json', 'node_modules/vite/index.js',
      'node_modules/vite/node_modules/rolldown/package.json', 'node_modules/vitest/index.js',
      'node_modules/vitest/node_modules/vite/index.js', nested
    ].map((file) => [file, '{}\n'])))

    expect(vite(scratch).resolve('rolldown/package.json')).toBe(join(scratch, nested))
  }
)

test(
  'reads each tsconfig through the rolldown beside the Vite that Vitest loads',
  async ({ scratch }) => {
    const rolldown = 'node_modules/vitest/node_modules/vite/node_modules/rolldown'

    await plant(scratch, {
      'node_modules/vitest/index.js'                   : '',
      'node_modules/vitest/node_modules/vite/index.js' : '',
      [`${rolldown}/experimental.js`]                  : "throw new Error('nested')\n",
      [`${rolldown}/package.json`]                     : '{}\n'
    })

    expect(() => triggers(scratch, [])).toThrow('nested')
  }
)

test(
  'lists a tsconfig an extends chain reaches through a linked file beside the file the link names',
  async ({ scratch }) => {
    await plant(scratch, {
      'a.ts'          : 'export const a = 1\n',
      'base.json'     : '{}\n',
      'tsconfig.json' : '{ "extends": "./link.json" }\n'
    })
    await Promise.all([
      symlink('base.json', join(scratch, 'link.json')),
      symlink(join(root, 'node_modules'), join(scratch, 'node_modules'))
    ])

    expect(triggers(scratch, ['a.ts'])).toEqual(expect.arrayContaining([
      join(scratch, 'base.json'), join(scratch, 'link.json')
    ]))
  }
)

test.for([
  { changed: 'art/day-frame.css', name: 'a test spelling it in a template', selected: ['frame.test.ts'] },
  { changed: 'cfg/package.json', name: 'no test for an import or export naming it', selected: [] },
  { changed: 'docs/guide/a.md', name: 'a test spelling a directory holding it', selected: ['dir.test.ts'] },
  { changed: 'drafts/a.md', name: 'no test for a glob beside a part of a template', selected: [] },
  { changed: 'lib/b.sh', name: 'a test spelling a program sourcing it in turn', selected: ['tool.test.ts'] },
  { changed: 'logs/a.txt', name: 'no test for a program naming it through a glob', selected: [] },
  { changed: 'misc.md', name: 'no test for a glob naming no directory alone', selected: [] },
  { changed: 'notes/a.md', name: 'a test spelling it behind a leading $ segment', selected: ['var.test.ts'] },
  { changed: 'pages/b.md', name: 'a test joining a glob to its directory', selected: ['pages.test.ts'] },
  {
    changed  : 'share/a.txt',
    name     : 'a test importing a module spelling it through a template',
    selected : ['load.test.ts']
  },
  { changed: 'tasks/labels', name: 'no test for a string of one segment holding no dot', selected: [] }
])('selects $name where a branch changes only $changed', async ({ changed, selected }, { scratch }) => {
  await checkout(changed, scratch)

  expect(await provided(scratch, 'origin/main')).toEqual([changed, ...selected])
})

test(
  'selects the test reading an uncommitted change alone where the run names no commit to start from',
  async ({ scratch }) => {
    await checkout('notes/a.md', scratch)
    await appendFile(join(scratch, 'docs', 'guide', 'a.md'), '\n')

    expect(await provided(scratch)).toEqual(['docs/guide/a.md', 'dir.test.ts'])
  }
)

test.for([
  { changed: 'notes.md', name: 'no test for a Markdown file outside srcDir', selected: [] },
  { changed: 'pages/dist/a.md', name: 'no test for a page under a dist folder', selected: [] },
  { changed: 'pages/drafts/a.md', name: 'no test for a page srcExclude leaves out', selected: [] },
  { changed: 'pages/guide/a.md', name: 'each test under .vitepress reading the pages', selected: PAGE_TESTS }
].flatMap((row) => Object.entries(BRANCHES).map(([verb, deleted]) => ({ ...row, deleted, verb }))))(
  'selects $name where a branch $verb only $changed',
  async ({ changed, deleted, selected }, { scratch }) => {
    await site(changed, join(root, 'node_modules'), scratch, deleted)

    expect(new Set(await provided(scratch, 'origin/main', PAGED))).toEqual(new Set([changed, ...selected]))
  }
)

test('selects each test reading the pages of a site where a branch adds a page', async ({ scratch }) => {
  await site('notes.txt', join(root, 'node_modules'), scratch)
  await plant(scratch, { 'pages/guide/b.md': '# B\n' })

  expect(new Set(await provided(scratch, 'origin/main', PAGED))).toEqual(new Set([
    'notes.txt', 'pages/guide/b.md', ...PAGE_TESTS
  ]))
})

test(
  'selects no test importing only an export of a listing module that lists no page',
  async ({ scratch }) => {
    await site('pages/guide/a.md', join(root, 'node_modules'), scratch)

    const files = await provided(scratch, 'origin/main', PAGED)

    expect(files).toContain('.vitepress/tests/list.test.ts')
    expect(files).not.toContain('.vitepress/tests/cards.test.ts')
    expect(files).not.toContain('.vitepress/tests/lede.test.ts')
    expect(files).not.toContain('.vitepress/tests/names.test.ts')
    expect(files).not.toContain('.vitepress/tests/prop.test.ts')
    expect(files).not.toContain('.vitepress/tests/shadow.test.ts')
    expect(files).not.toContain('.vitepress/tests/title.test.ts')
  }
)

test('fails where no vitepress resolves beside a site test calling resolveConfig', async ({ scratch }) => {
  await site('pages/guide/a.md', undefined, scratch)

  await expect(provided(scratch, 'origin/main', PAGED)).rejects.toThrow(`vitepress in ${scratch}:`)
})

test('resolves no site where a branch changes no Markdown file', async ({ scratch }) => {
  await site('notes.txt', undefined, scratch)

  expect(await provided(scratch, 'origin/main', PAGED)).toEqual(['notes.txt'])
})

test.for<{ files: Record<string, string>, module: string, name: string, tsconfigs: string[] }>([
  {
    module    : 'a/x.ts',
    name      : 'lists each reference the transform tests before the tsconfig.json that claims a module',
    tsconfigs : ['a/other.json', 'a/tsconfig.json'],
    files     : {
      'a/other.json'    : '{ "include": ["c"] }\n',
      'a/tsconfig.json' : '{ "references": [{ "path": "./other.json" }] }\n',
      'a/x.ts'          : 'export const x = 1\n'
    }
  },
  {
    module : 'a/b/x.ts',
    name   : 'lists each tsconfig the transform tests for a module, up to the reference that claims it',

    files: {
      'a/after.json'       : '{}\n',
      'a/b/base.json'      : '{ "files": [], "references": [{ "path": "./inherited.json" }] }\n',
      'a/b/deep.json'      : '{}\n',
      'a/b/include.json'   : '{ "include": ["c"] }\n',
      'a/b/inherited.json' : '{}\n',
      'a/b/other.json'     : '{ "extends": "./include.json", "references": [{ "path": "./deep.json" }] }\n',
      'a/b/tsconfig.json'  : '{ "extends": "./base.json", "references": [{ "path": "./other" }] }\n',
      'a/b/x.ts'           : 'export const x = 1\n',
      'a/own.json'         : '{}\n',
      'a/ref.json'         : '{}\n',
      'a/tsconfig.json'    : '{ "extends": "./own.json", '
                           + '"references": [{ "path": "ref.json" }, { "path": "./after.json" }] }\n',
      'tsconfig.json'      : '{}\n'
    },

    tsconfigs: [
      'a/b/base.json', 'a/b/include.json', 'a/b/other.json', 'a/b/tsconfig.json', 'a/ref.json',
      'a/tsconfig.json'
    ]
  }
])('$name', async ({ files, module, tsconfigs }, { scratch }) => {
  await plant(scratch, files)
  await symlink(join(root, 'node_modules'), join(scratch, 'node_modules'))

  const tested = triggers(scratch, [module])
    .map((file) => relative(scratch, file))
    .filter((file) => !file.startsWith('..') && !file.endsWith('package.json'))

  expect(new Set(tested)).toEqual(new Set(tsconfigs))
})

test(
  'lists the path a tsconfig.json takes up to the filesystem root where no config claims a module',
  async ({ scratch }) => {
    await plant(scratch, { 'a/tsconfig.json': '{ "include": ["c"] }\n', 'a/x.ts': 'export const x = 1\n' })
    await symlink(join(root, 'node_modules'), join(scratch, 'node_modules'))

    expect(triggers(scratch, ['a/x.ts'])).toEqual(expect.arrayContaining([
      join(scratch, 'a', 'tsconfig.json'), join(scratch, 'tsconfig.json'),
      join(parse(scratch).root, 'tsconfig.json')
    ]))
  }
)

it.each(['95', '87.5'])('holds every coverage metric to a COVERAGE_FLOOR of %s', async (floor) => {
  vi.stubEnv('COVERAGE_FLOOR', floor)
  vi.resetModules()

  const { default: fresh } = await import('./vitest.config.js')
  const share              = Number(floor)

  expect(fresh.test?.coverage?.thresholds)
    .toEqual({ branches: share, functions: share, lines: share, statements: share })
})

it.each([
  { floor: undefined, held: 'nothing' },
  { floor: '', held: '""' },
  { floor: ' ', held: '" "' },
  { floor: 'ninety-five', held: '"ninety-five"' },
  { floor: 'Infinity', held: '"Infinity"' }
])('fails to load where COVERAGE_FLOOR holds $held', async ({ floor, held }) => {
  vi.stubEnv('COVERAGE_FLOOR', floor)
  vi.resetModules()

  await expect(import('./vitest.config.js')).rejects.toThrow(`COVERAGE_FLOOR holds ${held}, whereas`)
})

it('writes the snapshot file of a case beside its test', () => {
  const { snapshotPath, testFilePath } = expect.getState().snapshotState

  expect(snapshotPath).toBe(`${testFilePath}.snap`)
})

it.each([
  {
    actions   : 'true',
    name      : 'annotates a failure and writes no job summary under GitHub Actions',
    reporters : ['default', ['github-actions', { jobSummary: { enabled: false } }]]
  },
  {
    actions   : undefined,
    name      : 'reports through the default reporter alone outside GitHub Actions',
    reporters : ['default']
  }
])('$name', async ({ actions, reporters }) => {
  vi.stubEnv('GITHUB_ACTIONS', actions)
  vi.resetModules()

  const { default: fresh } = await import('./vitest.config.js')

  expect(fresh.test?.reporters).toEqual(reporters)
})

it.each(spawning)('opens $file, which runs a child process, on a tag that sets its limit', ({ text }) => {
  const pragmas = config.test?.tags?.map(({ name }) => `/** @module-tag ${name} */`)

  expect(text.slice(0, text.indexOf('\n'))).toBeOneOf(pragmas ?? [])
})

test.for([
  { file: 'own', name: 'finds a test file importing node:child_process itself', runs: true },
  { file: 'repository', name: 'finds a test file importing a helper that runs a child process', runs: true },
  {
    file : 'affected',
    name : 'finds a test file importing a helper whose own import runs a child process',
    runs : true
  },
  {
    file : 'barrel',
    name : 'finds a test file importing a helper that re-exports one running a child process',
    runs : true
  },
  {
    file : 'cycle',
    name : 'finds no test file importing helpers that import each other and run no child process',
    runs : false
  },
  {
    file : 'dynamic',
    name : 'finds a test file that imports a helper running a child process through a dynamic import',
    runs : true
  },
  {
    file : 'template',
    name : 'finds a test file importing that helper through a template literal holding no substitution',
    runs : true
  },
  {
    file : 'package',
    name : 'finds no test file importing a helper whose package under node_modules runs a child process',
    runs : false
  },
  {
    file : 'scratch',
    name : 'finds no test file importing only a helper that runs no child process',
    runs : false
  },
  {
    file : 'start',
    name : 'finds no test file importing a module outside the common folder that runs a child process',
    runs : false
  },
  {
    file : 'types',
    name : 'finds no test file importing a helper that takes only types from one running a child process',
    runs : false
  },
  {
    file : 'reexport',
    name : 'finds no test file importing a helper re-exporting only types from one running a child process',
    runs : false
  },
  {
    file : 'vet',
    name : 'finds a test file importing a helper whose import outside the common folder runs a child process',
    runs : true
  }
])('$name', async ({ file, runs }, { scratch }) => {
  await plant(scratch, {
    'lib/start.ts'                      : "import { spawn } from 'node:child_process'\n",
    'node_modules/spawner/index.js'     : "import 'node:child_process'\n",
    'node_modules/spawner/package.json' : '{ "exports": "./index.js", "name": "spawner" }\n',
    'tests/plugin/affected.test.ts'     : "import './common/affected.js'\n",
    'tests/plugin/common/a.ts'          : "import './b.js'\n",
    'tests/plugin/common/affected.ts'   : "import './repository.js'\n",
    'tests/plugin/common/b.ts'          : "import './a.js'\n",
    'tests/plugin/common/barrel.ts'     : "export { repository } from './repository.js'\n",
    'tests/plugin/common/kinds.ts'      : "export type { Run } from './repository.js'\n",
    'tests/plugin/common/mise.ts'       : "import type { Run } from './repository.js'\n",
    'tests/plugin/common/package.ts'    : "import 'spawner'\n",
    'tests/plugin/common/repository.ts' : "import { execFileSync } from 'node:child_process'\n",
    'tests/plugin/common/scratch.ts'    : "import { tmpdir } from 'node:os'\n",
    'tests/plugin/common/vet.ts'        : "import '../../../lib/start.ts'\n",
    'tests/plugin/barrel.test.ts'       : "import { repository } from './common/barrel.js'\n",
    'tests/plugin/cycle.test.ts'        : "import './common/a.js'\n",
    'tests/plugin/dynamic.test.ts'      : "await import('./common/repository.js')\n",
    'tests/plugin/own.test.ts'          : "import { spawn } from 'node:child_process'\n",
    'tests/plugin/package.test.ts'      : "import './common/package.js'\n",
    'tests/plugin/reexport.test.ts'     : "import { Run } from './common/kinds.js'\n",
    'tests/plugin/repository.test.ts'   : "import { repository } from './common/repository.js'\n",
    'tests/plugin/scratch.test.ts'      : "import { plant } from './common/scratch.js'\n",
    'tests/plugin/start.test.ts'        : "import { start } from '../../lib/start.ts'\n",
    'tests/plugin/template.test.ts'     : 'await import(`./common/repository.js`)\n',
    'tests/plugin/types.test.ts'        : "import { mise } from './common/mise.js'\n",
    'tests/plugin/vet.test.ts'          : "import './common/vet.js'\n"
  })

  expect(derived(`tests/plugin/${file}.test.ts`, scratch)).toBe(runs)
})

it('keeps each dynamic import naming a string or template literal holding no substitution or escape', () => {
  const text = "import('./a.js')\nimport(\"./b.js\")\nimport(`./c.js`)\nimport(`./$d.js`)\n"
             + "import(`./${e}.js`)\nimport('./f' + g)\nimport(g + './f.js')\nimport(h)\n"
             + "import('./\\x69.js')\nimport(\"./\\x6a.js\")\nimport(`./\\x6b.js`)\n"

  expect(requests(parseSync('x.ts', text).module, text)).toEqual([
    ['./a.js', ['*']], ['./b.js', ['*']], ['./c.js', ['*']], ['./$d.js', ['*']]
  ])
})

it('reads a tag pragma off the first line of a test file alone', () => {
  const stray = sources.filter(({ text }) => pragma.test(text.slice(text.indexOf('\n'))))

  expect(stray.map(({ file }) => file)).toEqual([])
})

it('opens no test file but one that runs a child process on a tag', () => {
  const tagged = sources.filter(({ text }) => pragma.test(text.slice(0, text.indexOf('\n'))))

  expect(tagged.map(({ file }) => file)).toEqual(spawning.map(({ file }) => file))
})
