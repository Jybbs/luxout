/** @module-tag spawns */
import { spawnSync } from 'node:child_process'
import { symlink }   from 'node:fs/promises'
import { join }      from 'node:path'

import { expect } from 'vitest'

import { Audit }        from '../../../.mise/audit/audit.ts'
import { DeployPaths }   from '../../../.mise/audit/deploy.ts'
import { YamlFile }      from '../../../.mise/audit/files.ts'
import type { Finding }  from '../../../.mise/audit/finding.ts'
import { TaskList }      from '../../../.mise/audit/tasks.ts'
import { listing, mise } from '../../common/mise.js'
import { repository }    from '../../common/repository.js'
import { plant, test }   from '../../common/scratch.js'

const ALL       = ['.github/actions/provision/**', '.github/workflows/deploy.yml', '.mise/**', 'site/**']
const CONFIG    = 'site/.vitepress/config.ts'
const FACE      = 'site/.vitepress/lib/face.ts'
const LIB       = 'site/lib/a.ts'
const PROVISION = ['.github/actions/provision/action.yml', '.mise/config.toml', '.mise/mise.lock']
const THEME     = 'site/.vitepress/theme/index.ts'
const WORKFLOW  = '.github/workflows/deploy.yml'
const root      = join(import.meta.dirname, '../../..')

const PAGES = {
  'site/.vitepress/config.ts'      : "import { FACE } from './lib/face.ts'\n\nexport default { FACE }\n",
  'site/.vitepress/fonts/face.ttf' : '',
  'site/.vitepress/lib/face.ts'    : "export const FACE = 'fonts/face.ttf'\n",
  'site/index.md'                  : '![The sun](./sun.svg)\n',
  'site/package.json'              : '{ "type": "module" }\n',
  'site/public/logo.svg'           : '<svg/>\n',
  'site/sun.svg'                   : '<svg/>\n'
}

const SCRIPTS = {
  '.mise/tasks/site/linkcheck' : 'lychee dist\n',
  '.mise/tasks/site/press'     : 'vitepress build\n'
}

const TASKS = [
  { depends: ['site:press'], file: true, name: 'site:linkcheck', source: '.mise/tasks/site/linkcheck' },
  { file: true, name: 'site:press', source: '.mise/tasks/site/press' }
]

const named = (findings: Finding[]): string[] => findings.map(({ message }) => message.split('`')[1] ?? '')

/**
 * Stages every file under `scratch` in a new repository, links the site's
 * packages in, and returns an audit there that runs Git itself and answers
 * each other command through `mise`.
 */
async function staged(scratch: string): Promise<Audit> {
  const stub = mise([])

  repository(scratch)('add', '--all')
  await symlink(join(root, 'site/node_modules'), join(scratch, 'site/node_modules'))

  return new Audit(scratch, (command, args, options) =>
    command === 'git' ? spawnSync(command, args, options) : stub(command, args, options)
  )
}

async function tasks(scratch: string): Promise<TaskList> {
  await plant(scratch, SCRIPTS)

  return TaskList.read(new Audit(scratch, mise(listing(scratch, TASKS))))
}

const unmatched = async (
  scratch  : string,
  globs    : string[],
  imports  : string[] = [],
  wrappers : string[] = []
): Promise<string[]> =>
  named(new DeployPaths(workflow(globs), { [CONFIG]: imports }, wrappers).findings(await tasks(scratch)))

const triggers = (globs: string[]): string => [
  'on:',
  '  push:',
  '    branches:',
  '      - main',
  '    paths:',
  ...globs.map((glob) => `      - ${JSON.stringify(glob)}`)
].join('\n')

const workflow = (globs: string[]): YamlFile => new YamlFile(WORKFLOW, triggers(globs))

test('reports each file the site build reads that no glob matches, at the line the globs open on', async ({
  scratch
}) => {
  const imports  = { [CONFIG]: [CONFIG, 'bun.lock'], [THEME]: [THEME, 'config.schema.json'] }
  const findings = new DeployPaths(workflow(['site/lib/**']), imports, []).findings(await tasks(scratch))
  const reported = (file: string, reason: string): unknown[] => [
    { file: WORKFLOW, line: 6 },
    'Deploy path',
    `\`${file}\` matches no \`on.push.paths\` glob, though ${reason}, so a push changing it leaves the site `
  + 'unpublished'
  ]

  expect(findings.map(({ message, spot, title }) => [spot, title, message])).toEqual([
    reported(CONFIG, 'VitePress loads it as the site config'),
    reported('bun.lock', 'building `site/.vitepress/config.ts` and its imports reads it'),
    reported(THEME, 'VitePress loads it as the site theme'),
    reported('config.schema.json', 'building `site/.vitepress/theme/index.ts` and its imports reads it'),
    ...Object.keys(SCRIPTS).map((file) => reported(file, '`site:linkcheck` runs it')),
    ...PROVISION.map((file) => reported(file, 'the press job installs its tools through it')),
    reported(WORKFLOW, 'it sets the jobs that build and publish the site')
  ])
})

test.for([
  { globs: ALL, name: 'a `**` glob matching a segment opening on a dot', reported: [] },
  { globs: [...ALL, '!site/lib/*.ts'], name: 'a `!` glob after a match', reported: [LIB] },
  { globs: [...ALL, '!site/lib/*.ts', 'site/lib/a*'], name: 'a glob after a `!` glob', reported: [] },
  { globs: [LIB, '!site/**', ...ALL], name: 'a `!` glob before a match', reported: [] },
  { globs: [...ALL.slice(0, 3), 'site/*', 'site/.vitepress/*'], name: 'a `*` glob', reported: [LIB] }
])('reads $name as GitHub does', async ({ globs, reported }, { scratch }) => {
  expect(await unmatched(scratch, globs, [CONFIG, LIB])).toEqual(reported)
})

test('reports a wrapper under .mise/bin that a task of the build calls, and no other', async ({
  scratch
}) => {
  const wrappers = ['.mise/bin/tsc', '.mise/bin/vitepress']

  expect(await unmatched(scratch, ['.github/**', '.mise/tasks/**', '.mise/*.*'], [], wrappers))
    .toEqual(['.mise/bin/vitepress'])
})

test('reports nothing for a workflow that runs on every push', async ({ scratch }) => {
  const file = new YamlFile(WORKFLOW, 'on:\n  push:\n    branches:\n      - main\n')

  expect(new DeployPaths(file, { [CONFIG]: ['bun.lock'] }, []).findings(await tasks(scratch))).toEqual([])
})

test('reads the modules the site config imports and the files read to install them', async ({ scratch }) => {
  await plant(scratch, {
    '.github/workflows/deploy.yml' : ['on:', '  push:', '    paths:', '      - site/**'].join('\n'),
    'data.json'                    : '{}\n',
    'package.json'                 : '{}\n',
    'site/.vitepress/config.ts'    : "import data from '../../data.json' with { type: 'json' }\n"
                                   + "import { a } from './lib/a.ts'\n\nexport default { a, data }\n",
    'site/.vitepress/lib/a.ts'     : 'export const a = 1\n',
    'site/package.json'            : '{ "type": "module" }\n'
  })
  const audit = await staged(scratch)

  expect(audit.imports('site', '.vitepress/config.ts')).toEqual(expect.arrayContaining([
    'data.json', 'site/.vitepress/config.ts', 'site/.vitepress/lib/a.ts', 'site/package.json'
  ]))
  expect(named((await DeployPaths.read(audit)).findings(TaskList.read(audit))))
    .toEqual(['data.json', 'tsconfig.json', ...PROVISION, WORKFLOW])
})

test('reads the modules the site theme imports beside those of the site config', async ({ scratch }) => {
  await plant(scratch, {
    '.github/workflows/deploy.yml'   : ['on:', '  push:', '    paths:', '      - site/**'].join('\n'),
    'config.schema.json'             : '{}\n',
    'site/.vitepress/config.ts'      : 'export default {}\n',
    'site/.vitepress/theme/index.ts' : "import data from '../../../config.schema.json' with { type: 'json' }"
                                     + '\n\nexport default { data }\n',
    'site/package.json'              : '{ "type": "module" }\n'
  })
  const audit = await staged(scratch)

  expect(named((await DeployPaths.read(audit)).findings(TaskList.read(audit))))
    .toEqual(['tsconfig.json', 'config.schema.json', ...PROVISION, WORKFLOW])
})

test('reads the modules the site theme imports in a checkout with no site config', async ({ scratch }) => {
  await plant(scratch, {
    '.github/workflows/deploy.yml'   : ['on:', '  push:', '    paths:', '      - site/**'].join('\n'),
    'config.schema.json'             : '{}\n',
    'site/.vitepress/theme/index.ts' : "import data from '../../../config.schema.json' with { type: 'json' }"
                                     + '\n\nexport default { data }\n',
    'site/package.json'              : '{ "type": "module" }\n'
  })
  const audit = await staged(scratch)

  expect(named((await DeployPaths.read(audit)).findings(TaskList.read(audit))))
    .toEqual(['config.schema.json', 'tsconfig.json', ...PROVISION, WORKFLOW])
})

test.for<{ files: Record<string, string>, name: string, reported: string[] }>([
  { files: {}, name: 'no deploy workflow', reported: [] },
  {
    files    : { [WORKFLOW]: 'on:\n  push:\n    paths:\n      - site/**\n' },
    name     : 'no site config',
    reported : [...PROVISION, WORKFLOW]
  }
])('reads a checkout with $name', async ({ files, reported }, { scratch }) => {
  await plant(scratch, files)

  const audit = new Audit(scratch, mise([]))

  expect(named((await DeployPaths.read(audit)).findings(TaskList.read(audit)))).toEqual(reported)
})

test.for([
  { file: 'site/index.md', reason: 'VitePress builds it as a page' },
  { file: 'site/sun.svg', reason: 'the page `site/index.md` embeds it' },
  { file: 'site/public/logo.svg', reason: 'VitePress copies it from the public directory into the bundle' },
  {
    file   : 'site/.vitepress/fonts/face.ttf',
    reason : '`site/.vitepress/lib/face.ts`, a module the site build imports, spells its path'
  },
  { file: WORKFLOW, reason: 'it sets the jobs that build and publish the site' }
])('reports $file, which the site build reads without importing it, where no glob matches it', async (
  { file, reason },
  { scratch }
) => {
  await plant(scratch, { ...PAGES, [WORKFLOW]: triggers(['**', `!${file}`]) })

  const audit    = await staged(scratch)
  const findings = (await DeployPaths.read(audit)).findings(TaskList.read(audit))

  expect(findings.map(({ message }) => message)).toEqual([
    `\`${file}\` matches no \`on.push.paths\` glob, though ${reason}, so a push changing it leaves the site `
  + 'unpublished'
  ])
})

test('reads each file a page embeds by a relative path, resolved as VitePress resolves an image', async ({
  scratch
}) => {
  const images = ['./a%20b.svg', 'sun.svg?raw#top', '../up.svg', '/logo.svg', 'https://example.com/a.png']

  await plant(scratch, {
    'site/.vitepress/config.ts' : 'export default {}\n',
    'site/guide/index.md'       : images.map((image) => `![An image](${image})\n`).join('\n'),
    'site/package.json'         : '{ "type": "module" }\n'
  })

  expect(await (await staged(scratch)).site('site')).toEqual({
    pages     : new Map([
      ['site/guide/index.md', ['site/guide/a b.svg', 'site/guide/sun.svg', 'site/up.svg']]
    ]),
    publicDir : 'site/public'
  })
})

test('reads each page under the config’s `srcDir` that no `srcExclude` glob matches', async ({
  scratch
}) => {
  await plant(scratch, {
    'site/.vitepress/config.ts' : "export default { srcDir: 'docs', srcExclude: ['drafts/**'] }\n",
    'site/docs/drafts/a.md'     : '# A draft\n',
    'site/docs/index.md'        : '# Home\n',
    'site/index.md'             : '# Outside the source directory\n',
    'site/package.json'         : '{ "type": "module" }\n'
  })

  expect(await (await staged(scratch)).site('site')).toEqual({
    pages     : new Map([['site/docs/index.md', []]]),
    publicDir : 'site/docs/public'
  })
})

test.for<{ excluded: string, files: Record<string, string>, name: string }>([
  {
    excluded : 'site/public/logo.svg',
    files    : { 'site/.vitepress/config.ts': 'export default { vite: { publicDir: false } }\n' },
    name     : 'the public directory where the site config turns it off'
  },
  {
    excluded : 'site/.vitepress/tests/**',
    files    : { 'site/.vitepress/tests/fonts/face.ttf': '' },
    name     : 'the site suite, though a module string names a file there'
  },
  {
    excluded : 'site/.vitepress/fonts/src.ttf',
    files    : {
      [CONFIG]                        : "import { SRC } from '../../src/face.ts'\n\nexport default { SRC }\n",
      'package.json'                  : '{ "type": "module" }\n',
      'site/.vitepress/fonts/src.ttf' : '',
      'src/face.ts'                   : "export const SRC = 'fonts/src.ttf'\n"
    },
    name     : 'the site that only a module outside the site spells'
  },
  {
    excluded : 'site/.vitepress/lib/bundle/index.ts',
    files    : {
      [FACE]                                : `${PAGES[FACE]}export const SOURCE = 'index.ts'\n`,
      'site/.vitepress/lib/bundle/index.ts' : ''
    },
    name     : 'the site that a module names by its file name alone'
  },
  {
    excluded : 'site/frame.svg',
    files    : { [FACE]: `${PAGES[FACE]}export const FRAME = './frame.svg'\n`, 'site/frame.svg': '<svg/>\n' },
    name     : 'the site that a module names by a path naming no directory'
  },
  {
    excluded : 'site/.vitepress/lib/frame.svg',
    files    : {
      [FACE]                          : `${PAGES[FACE]}export const FRAME = 'frame.svg'\n`,
      'site/.vitepress/lib/frame.svg' : '<svg/>\n'
    },
    name     : 'the site that a module names by the file name alone of a file beside it'
  }
])('reports no file under $name', async ({ excluded, files }, { scratch }) => {
  await plant(scratch, { ...PAGES, ...files, [WORKFLOW]: triggers(['**', `!${excluded}`]) })

  const audit = await staged(scratch)

  expect((await DeployPaths.read(audit)).findings(TaskList.read(audit))).toEqual([])
})

test.for([
  { beside: 'site/.vitepress/lib/face.ttf', spelling: './face.ttf' },
  { beside: 'site/.vitepress/face.ttf', spelling: '../face.ttf' }
])('reports $beside, which a module the site build imports reads through the relative URL $spelling', async (
  { beside, spelling },
  { scratch }
) => {
  const reads = `export const BESIDE = readFileSync(new URL('${spelling}', import.meta.url))\n`

  await plant(scratch, {
    ...PAGES,
    [FACE]     : `import { readFileSync } from 'node:fs'\n\n${PAGES[FACE]}${reads}`,
    [beside]   : '',
    [WORKFLOW] : triggers(['**', `!${beside}`])
  })

  const audit    = await staged(scratch)
  const findings = (await DeployPaths.read(audit)).findings(TaskList.read(audit))

  expect(findings.map(({ message }) => message)).toEqual([
    `\`${beside}\` matches no \`on.push.paths\` glob, though \`${FACE}\`, a module the site build imports, `
  + 'spells its path, so a push changing it leaves the site unpublished'
  ])
})

test('reports a module the site build imports by its import, though a module spells its path', async ({
  scratch
}) => {
  await plant(scratch, {
    ...PAGES,
    [FACE]     : `${PAGES[FACE]}export const SELF = 'lib/face.ts'\n`,
    [WORKFLOW] : triggers(['**', `!${FACE}`])
  })

  const audit    = await staged(scratch)
  const findings = (await DeployPaths.read(audit)).findings(TaskList.read(audit))

  expect(findings.map(({ message }) => message)).toEqual([
    `\`${FACE}\` matches no \`on.push.paths\` glob, though building \`${CONFIG}\` and its imports reads it, `
  + 'so a push changing it leaves the site unpublished'
  ])
})

test('reports a page by its page, though a module the site build imports spells its path', async ({
  scratch
}) => {
  await plant(scratch, {
    ...PAGES,
    [FACE]     : `${PAGES[FACE]}export const HOME = 'site/index.md'\n`,
    [WORKFLOW] : triggers(['**', '!site/index.md'])
  })

  const audit    = await staged(scratch)
  const findings = (await DeployPaths.read(audit)).findings(TaskList.read(audit))

  expect(findings.map(({ message }) => message)).toEqual([
    '`site/index.md` matches no `on.push.paths` glob, though VitePress builds it as a page, '
  + 'so a push changing it leaves the site unpublished'
  ])
})

test('reads no page, public file, or spelled file in a checkout with a theme and no site config', async ({
  scratch
}) => {
  const site   = Object.entries(PAGES).filter(([file]) => file !== CONFIG)
  const unread = ['site/index.md', 'site/sun.svg', 'site/public/logo.svg', 'site/.vitepress/fonts/face.ttf']

  await plant(scratch, {
    ...Object.fromEntries(site),
    [THEME]    : "import { FACE } from '../lib/face.ts'\n\nexport default { FACE }\n",
    [WORKFLOW] : triggers(['**', ...unread.map((file) => `!${file}`)])
  })

  const audit = await staged(scratch)

  expect((await DeployPaths.read(audit)).findings(TaskList.read(audit))).toEqual([])
})

test.for([
  {
    files  : { 'site/index.md': '![The sun](./sun.svg)\n\n![The logo](./public/logo.svg)\n' },
    name   : 'a page embeds',
    reason : 'the page `site/index.md` embeds it'
  },
  {
    files  : { [FACE]: `${PAGES[FACE]}export const LOGO = 'public/logo.svg'\n` },
    name   : 'a module spells',
    reason : 'VitePress copies it from the public directory into the bundle'
  }
])('reports a public file $name by the reason ranked higher, where no glob matches it', async (
  { files, reason },
  { scratch }
) => {
  await plant(scratch, { ...PAGES, ...files, [WORKFLOW]: triggers(['**', '!site/public/logo.svg']) })

  const audit    = await staged(scratch)
  const findings = (await DeployPaths.read(audit)).findings(TaskList.read(audit))

  expect(findings.map(({ message }) => message)).toEqual([
    `\`site/public/logo.svg\` matches no \`on.push.paths\` glob, though ${reason}, so a push changing it `
  + 'leaves the site unpublished'
  ])
})
