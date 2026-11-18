import { symlink } from 'node:fs/promises'
import { join }    from 'node:path'

import { expect } from 'vitest'

import { Audit }         from '../../../.mise/audit/audit.ts'
import { DeployPaths }   from '../../../.mise/audit/deploy.ts'
import { YamlFile }      from '../../../.mise/audit/files.ts'
import type { Finding }  from '../../../.mise/audit/finding.ts'
import { TaskList }      from '../../../.mise/audit/tasks.ts'
import { listing, mise } from '../../common/mise.js'
import { plant, test }   from '../../common/scratch.js'

const ALL       = ['.github/actions/provision/**', '.mise/**', 'site/**']
const LIB       = 'site/lib/a.ts'
const PROVISION = ['.github/actions/provision/action.yml', '.mise/config.toml', '.mise/mise.lock']
const WORKFLOW  = '.github/workflows/deploy.yml'
const root      = join(import.meta.dirname, '../../..')

const SCRIPTS = {
  '.mise/tasks/site/linkcheck' : 'lychee dist\n',
  '.mise/tasks/site/press'     : 'vitepress build\n'
}

const TASKS = [
  { depends: ['site:press'], file: true, name: 'site:linkcheck', source: '.mise/tasks/site/linkcheck' },
  { file: true, name: 'site:press', source: '.mise/tasks/site/press' }
]

const named = (findings: Finding[]): string[] => findings.map(({ message }) => message.split('`')[1] ?? '')

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
  named(new DeployPaths(workflow(globs), imports, wrappers).findings(await tasks(scratch)))

const workflow = (globs: string[]): YamlFile => new YamlFile(WORKFLOW, [
  'on:',
  '  push:',
  '    branches:',
  '      - main',
  '    paths:',
  ...globs.map((glob) => `      - ${JSON.stringify(glob)}`)
].join('\n'))

test('reports each file the site build reads that no glob matches, at the line the globs open on', async ({
  scratch
}) => {
  const findings = new DeployPaths(workflow(['site/**']), ['site/.vitepress/config.ts', 'bun.lock'], [])
    .findings(await tasks(scratch))

  expect(findings.map(({ message, spot, title }) => [spot, title, message])).toEqual([
    [{ file: WORKFLOW, line: 6 }, 'Deploy path', '`bun.lock` matches no `on.push.paths` glob, though '
  + '`site/.vitepress/config.ts` imports it or reads it, so a push changing it leaves the site unpublished'],
    ...['.mise/tasks/site/linkcheck', '.mise/tasks/site/press'].map((file) => [
      { file: WORKFLOW, line: 6 },
      'Deploy path',
      `\`${file}\` matches no \`on.push.paths\` glob, though \`site:linkcheck\` runs it, `
    + 'so a push changing it leaves the site unpublished'
    ]),
    ...PROVISION.map((file) => [
      { file: WORKFLOW, line: 6 },
      'Deploy path',
      `\`${file}\` matches no \`on.push.paths\` glob, though the press job installs its tools through it, `
    + 'so a push changing it leaves the site unpublished'
    ])
  ])
})

test.for([
  { globs: ALL, name: 'a `**` glob matching a segment opening on a dot', reported: [] },
  { globs: [...ALL, '!site/lib/*.ts'], name: 'a `!` glob after a match', reported: [LIB] },
  { globs: [...ALL, '!site/lib/*.ts', 'site/lib/a*'], name: 'a glob after a `!` glob', reported: [] },
  { globs: [LIB, '!site/**', ...ALL], name: 'a `!` glob before a match', reported: [] },
  { globs: [...ALL.slice(0, 2), 'site/*', 'site/.vitepress/*'], name: 'a `*` glob', reported: [LIB] }
])('reads $name as GitHub does', async ({ globs, reported }, { scratch }) => {
  expect(await unmatched(scratch, globs, ['site/.vitepress/config.ts', LIB])).toEqual(reported)
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

  expect(new DeployPaths(file, ['bun.lock'], []).findings(await tasks(scratch))).toEqual([])
})

test('reads the modules the site config imports and the files read to install them', async ({ scratch }) => {
  await plant(scratch, {
    '.github/workflows/deploy.yml' : ['on:', '  push:', '    paths:', '      - site/**'].join('\n'),
    'data.json'                    : '{}\n',
    'package.json'                 : '{}\n',
    'site/.vitepress/config.ts'    : "import data from '../../data.json' with { type: 'json' }\n"
                                   + "import { a } from './lib/a.ts'\n\nexport default { a, data }\n",
    'site/.vitepress/lib/a.ts'     : 'export const a = 1\n',
    'site/package.json'            : '{}\n'
  })
  await symlink(join(root, 'node_modules'), join(scratch, 'site/node_modules'))

  const audit = new Audit(scratch, mise([]))

  expect(audit.imports('site', '.vitepress/config.ts')).toEqual(expect.arrayContaining([
    'data.json', 'site/.vitepress/config.ts', 'site/.vitepress/lib/a.ts', 'site/package.json'
  ]))
  expect(named(DeployPaths.read(audit).findings(TaskList.read(audit))))
    .toEqual(['data.json', 'tsconfig.json', ...PROVISION])
})

test.for<{ files: Record<string, string>, name: string, reported: string[] }>([
  { files: {}, name: 'no deploy workflow', reported: [] },
  {
    files    : { [WORKFLOW]: 'on:\n  push:\n    paths:\n      - site/**\n' },
    name     : 'no site config',
    reported : PROVISION
  }
])('reads a checkout with $name', async ({ files, reported }, { scratch }) => {
  await plant(scratch, files)

  const audit = new Audit(scratch, mise([]))

  expect(named(DeployPaths.read(audit).findings(TaskList.read(audit)))).toEqual(reported)
})
