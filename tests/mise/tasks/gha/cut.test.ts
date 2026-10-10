import { execFileSync, spawnSync } from 'node:child_process'
import { readFile }                from 'node:fs/promises'
import { join }                    from 'node:path'
import { parseEnv }                from 'node:util'

import { expect } from 'vitest'

import { logged, standIn } from '../../../common/gh.js'
import { plant, test }     from '../../../common/scratch.js'

interface Conditions {
  event? : string
  fail?  : 'api' | 'release'
  pages? : Release[][]
  ref?   : string
}

interface Release {
  draft    : boolean
  html_url : string
  tag_name : string
}

const ADDRESS = 'https://github.com/Jybbs/luxout/releases/tag/untagged-5f0c2a'
const LISTING = ['api', '--paginate', '--slurp', 'repos/{owner}/{repo}/releases']
const task    = join(import.meta.dirname, '..', '..', '..', '..', '.mise', 'tasks', 'gha', 'cut')

const create = (version: string) => [
  'release', 'create', '--draft', '--generate-notes', '--target', 'main', '--title', version, version
]

/**
 * Commits each of `versions` in turn as the `version` in `package.json`, then
 * runs the task in `scratch` under a stand-in `gh` that answers `gh api` with
 * `pages` and fails each call to the command `fail` names.
 */
async function cut(
  scratch  : string,
  versions : string[],
  { event = 'push', fail, pages = [[]], ref = 'main' } : Conditions = {}
) {
  const env = {
    ...await standIn(scratch),
    GH_CREATED          : ADDRESS,
    GH_FAIL             : fail ?? '',
    GH_LIVE             : JSON.stringify(pages),
    GITHUB_EVENT_NAME   : event,
    GITHUB_OUTPUT       : join(scratch, 'output'),
    GITHUB_REF_NAME     : ref,
    GIT_AUTHOR_EMAIL    : 'cut@example.com',
    GIT_AUTHOR_NAME     : 'Cut',
    GIT_COMMITTER_EMAIL : 'cut@example.com',
    GIT_COMMITTER_NAME  : 'Cut',
    GIT_CONFIG_GLOBAL   : '/dev/null',
    GIT_CONFIG_NOSYSTEM : '1'
  }

  const git = (...args: string[]) => execFileSync('git', args, { cwd: scratch, env })

  await plant(scratch, { output: '' })
  git('init', '--quiet')

  for (const version of versions) {
    await plant(scratch, { 'package.json': JSON.stringify({ version }) })
    git('add', 'package.json')
    git('commit', '--allow-empty', '--message', version, '--quiet')
  }

  const { status, stderr, stdout } = spawnSync(task, { cwd: scratch, encoding: 'utf8', env })
  const outputs                    = parseEnv(await readFile(join(scratch, 'output'), 'utf8'))

  return { calls: await logged(scratch), outputs, status, stderr, stdout }
}

const release = (draft: boolean, tag: string) => ({
  draft    : draft,
  html_url : `https://github.com/Jybbs/luxout/releases/tag/${draft ? 'untagged-9d41b7' : tag}`,
  tag_name : tag
})

test('cuts nothing where a push leaves the version where HEAD~1 had it', async ({ scratch }) => {
  expect(await cut(scratch, ['0.1.0', '0.1.0'])).toEqual({
    calls   : [],
    outputs : { state: 'unmoved', version: '0.1.0' },
    status  : 0,
    stderr  : '',
    stdout  : 'Version 0.1.0 did not move since HEAD~1, so no draft is cut\n'
  })
})

test('creates a draft where the version moved and no release carries it', async ({ scratch }) => {
  expect(await cut(scratch, ['0.1.0', '0.2.0'], { pages: [[release(false, '0.1.0')]] })).toEqual({
    calls   : [LISTING, create('0.2.0')],
    outputs : { state: 'created', url: ADDRESS, version: '0.2.0' },
    status  : 0,
    stderr  : '',
    stdout  : `Created a draft release for version 0.2.0 at ${ADDRESS}\n`
  })
})

test('creates a draft on a dispatched run whose version did not move', async ({ scratch }) => {
  const { calls, outputs } = await cut(scratch, ['0.1.0', '0.1.0'], { event: 'workflow_dispatch' })

  expect({ calls, outputs }).toEqual({
    calls   : [LISTING, create('0.1.0')],
    outputs : { state: 'created', url: ADDRESS, version: '0.1.0' }
  })
})

test('leaves a draft already carrying the version untouched and reports its address', async ({ scratch }) => {
  const draft = release(true, '0.2.0')

  expect(await cut(scratch, ['0.1.0', '0.2.0'], { pages: [[release(false, '0.1.0'), draft]] })).toEqual({
    calls   : [LISTING],
    outputs : { state: 'draft', url: draft.html_url, version: '0.2.0' },
    status  : 0,
    stderr  : '',
    stdout  : `Version 0.2.0 already has a draft at ${draft.html_url}, so no draft is cut\n`
  })
})

test.for([
  { order: 'after', pages: [[release(true, '0.2.0'), release(false, '0.2.0')]] },
  { order: 'before', pages: [[release(false, '0.2.0'), release(true, '0.2.0')]] }
])(
  'skips the cut with a warning where a release listed $order a draft is published',
  async ({ pages }, { scratch }) => {
    expect(await cut(scratch, ['0.1.0', '0.2.0'], { pages })).toEqual({
      calls   : [LISTING],
      outputs : { state: 'published', url: release(false, '0.2.0').html_url, version: '0.2.0' },
      status  : 0,
      stderr  : '',
      stdout  : '::warning::Version 0.2.0 is already published, so no draft is cut\n'
    })
  }
)

test('reads a release carrying the version off a later page of the listing', async ({ scratch }) => {
  const draft = release(true, '0.2.0')

  const { calls, outputs } = await cut(scratch, ['0.1.0', '0.2.0'], {
    pages: [[release(false, '0.1.1')], [release(false, '0.1.0'), draft]]
  })

  expect({ calls, outputs }).toEqual({
    calls   : [LISTING],
    outputs : { state: 'draft', url: draft.html_url, version: '0.2.0' }
  })
})

test('fails without creating a draft where reading the releases fails', async ({ scratch }) => {
  const { calls, outputs, status } = await cut(scratch, ['0.1.0', '0.2.0'], { fail: 'api' })

  expect({ calls, outputs, status }).toEqual({ calls: [LISTING], outputs: { version: '0.2.0' }, status: 1 })
})

test('fails without reporting a state where creating the draft fails', async ({ scratch }) => {
  const { calls, outputs, status } = await cut(scratch, ['0.1.0', '0.2.0'], { fail: 'release' })

  expect({ calls, outputs, status }).toEqual({
    calls   : [LISTING, create('0.2.0')],
    outputs : { version: '0.2.0' },
    status  : 1
  })
})

test('fails before reading a release where the checkout has no HEAD~1 to compare', async ({ scratch }) => {
  const { calls, outputs, status } = await cut(scratch, ['0.1.0'])

  expect({ calls, failed: status !== 0, outputs }).toEqual({
    calls   : [],
    failed  : true,
    outputs : { version: '0.1.0' }
  })
})

test('fails before reading a release on a run from a branch other than main', async ({ scratch }) => {
  expect(await cut(scratch, ['0.1.0', '0.2.0'], { event: 'workflow_dispatch', ref: 'next' })).toEqual({
    calls   : [],
    outputs : {},
    status  : 1,
    stderr  : 'A cut from next fails, since the draft\'s tag lands on main\n',
    stdout  : ''
  })
})
