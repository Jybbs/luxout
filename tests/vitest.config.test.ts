import { existsSync }                     from 'node:fs'
import { glob, readFile, symlink }        from 'node:fs/promises'
import { dirname, join, parse, relative } from 'node:path'

import type * as Experimental from 'rolldown/experimental'
import { expect, it, vi }     from 'vitest'
import { defaultExclude }     from 'vitest/config'

import { plant, test }    from './common/scratch.js'
import { triggers, vite } from './common/triggers.js'
import thresholds         from './coverage.json' with { type: 'json' }
import config             from './vitest.config.js'

const pragma  = /(?:\/\/|\*)\s*@module-tag\s+[\w\-/]+/
const root    = dirname(import.meta.dirname)
const spawns  = /from '(?:node:child_process|[./]+\/common\/(?:sync|vet)\.js)'/
const files   = glob(config.test?.include ?? [], { cwd: root, exclude: defaultExclude })
const sources = await Array.fromAsync(files, async (file) => ({
  file : file,
  text : await readFile(join(root, file), 'utf8')
}))
const spawning = sources.filter(({ text }) => spawns.test(text))

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

it('reruns every test after a change to the runtime pins or a file read beside the imported modules', () => {
  const triggers = config.test?.forceRerunTriggers?.filter(existsSync).map((file) => relative(root, file))

  expect(new Set(triggers)).toEqual(new Set([
    '.mise/audit/tsconfig.json', '.mise/config.toml', '.mise/mise.lock', '.mise/vet/tsconfig.json',
    'bun.lock', 'bunfig.toml', 'package.json', 'site/.vitepress/vitest.config.ts', 'site/bun.lock',
    'src/tsconfig.json', 'src/ui/public/tsconfig.json', 'tests/common/triggers.ts',
    'tests/homebridge/bun.lock', 'tests/tsconfig.json', 'tests/vet/floor/bun.lock',
    'tests/vet/pinned/bun.lock', 'tests/vitest.config.ts'
  ]))
})

it.each(['.', 'site'])(
  'reads each tsconfig of the suite under %s through the rolldown its own Vite loads',
  (dir) => {
    expect(vite(join(root, dir)).resolve('rolldown/package.json'))
      .toBe(join(root, dir, 'node_modules', 'rolldown', 'package.json'))
  }
)

it('compiles every test file under tests/tsconfig.json in the transform Vite applies', () => {
  const { resolveTsconfig } = vite(root)('rolldown/experimental') as typeof Experimental

  const tsconfig = join(root, 'tests', 'tsconfig.json')
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

it('reads the coverage floor from tests/coverage.json', () => {
  expect(config.test?.coverage?.thresholds).toBe(thresholds)
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

it('runs an untagged case under Vitest’s 5 s default', ({ task }) => {
  expect(task.timeout).toBe(5000)
})

it('runs a case tagged spawns under 60 s', { tags: ['spawns'] }, ({ task }) => {
  expect(task.timeout).toBe(60_000)
})

it('runs a case tagged spawns-many under 180 s', { tags: ['spawns-many'] }, ({ task }) => {
  expect(task.timeout).toBe(180_000)
})

it.each(spawning)('opens $file, which runs a child process, on a tag that sets its limit', ({ text }) => {
  const pragmas = config.test?.tags?.map(({ name }) => `/** @module-tag ${name} */`)

  expect(text.slice(0, text.indexOf('\n'))).toBeOneOf(pragmas ?? [])
})

it.each(['tests/mise/bin.test.ts', 'tests/mise/tasks/lock/sync.test.ts', 'tests/mise/vet/vet.test.ts'])(
  'finds %s among the test files importing node:child_process, the sync helper, or the vet helper',
  (file) => {
    expect(spawning).toContainEqual(expect.objectContaining({ file }))
  }
)

it('reads a tag pragma off the first line of a test file alone', () => {
  const stray = sources.filter(({ text }) => pragma.test(text.slice(text.indexOf('\n'))))

  expect(stray.map(({ file }) => file)).toEqual([])
})

it('opens no test file but one that runs a child process on a tag', () => {
  const tagged = sources.filter(({ text }) => pragma.test(text.slice(0, text.indexOf('\n'))))

  expect(tagged.map(({ file }) => file)).toEqual(spawning.map(({ file }) => file))
})
