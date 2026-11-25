/** @module-tag spawns */
import { readFile } from 'node:fs/promises'
import { join }     from 'node:path'
import { parseEnv } from 'node:util'

import { describe } from 'vitest'

import { plant, test } from '../../../common/scratch.js'
import { sync }        from '../../../common/sync.js'

interface Conditions {
  event? : string
  fail?  : string
  pages? : Release[][]
  ref?   : string
}

interface Release {
  draft    : boolean
  html_url : string
  tag_name : string
}

const ADDRESS  = 'https://github.com/Jybbs/luxout/releases/tag/untagged-5f0c2a'
const ENDPOINT = 'repos/{owner}/{repo}/releases'
const NOTES    = '## What Changed\n\n* Keep the draft current by @Jybbs in #2'
const VERSION  = '0.2.0'
const CREATE   = [
  'release', 'create', '--draft', '--generate-notes', '--target', 'main', '--title', VERSION,
  VERSION
]
const EDIT      = ['release', 'edit', '--notes', NOTES, VERSION]
const GENERATOR = `${ENDPOINT}/generate-notes`
const LISTING   = ['api', '--paginate', '--slurp', ENDPOINT]
const GENERATE  = [
  'api', '--jq', '.body', '--raw-field', `tag_name=${VERSION}`, '--raw-field', 'target_commitish=main',
  GENERATOR
]

/**
 * Runs the task in `scratch` with `VERSION` as the `version` in `package.json`,
 * under a stand-in `gh` that answers the releases listing with `pages`, answers
 * the notes GitHub generates with `NOTES`, and fails each call naming `fail`.
 */
async function cut(
  scratch : string,
  { event = 'push', fail, pages = [[]], ref = 'main' } : Conditions = {}
) {
  await plant(scratch, { 'output': '', 'package.json': JSON.stringify({ version: VERSION }) })

  const { requests, status, stderr, stdout } = await sync(scratch, 'gha:cut', {
    fail : fail,
    live : { [ENDPOINT]: pages, [GENERATOR]: { body: NOTES, name: VERSION } },
    env  : {
      GH_CREATED        : ADDRESS,
      GITHUB_EVENT_NAME : event,
      GITHUB_OUTPUT     : join(scratch, 'output'),
      GITHUB_REF_NAME   : ref
    }
  })
  const outputs = parseEnv(await readFile(join(scratch, 'output'), 'utf8'))

  return { calls: requests, outputs, status, stderr, stdout }
}

const release = (draft: boolean, tag: string) => ({
  draft    : draft,
  html_url : `https://github.com/Jybbs/luxout/releases/tag/${draft ? 'untagged-9d41b7' : tag}`,
  tag_name : tag
})

describe.concurrent('gha:cut', () => {
  test.for(['push', 'workflow_dispatch'])(
    'creates a draft on a %s run where no release carries the version',
    async (event, { expect, scratch }) => {
      expect(await cut(scratch, { event, pages: [[release(false, '0.1.0')]] })).toEqual({
        calls   : [LISTING, CREATE],
        outputs : { state: 'created', url: ADDRESS, version: VERSION },
        status  : 0,
        stderr  : '',
        stdout  : `Created a draft release for version ${VERSION} at ${ADDRESS}\n`
      })
    }
  )

  test('creates a draft beside a draft of another version, leaving that draft as it stands', async ({
    expect,
    scratch
  }) => {
    const { calls, outputs } = await cut(scratch, { pages: [[release(true, '0.1.0')]] })

    expect({ calls, outputs }).toEqual({
      calls   : [LISTING, CREATE],
      outputs : { state: 'created', url: ADDRESS, version: VERSION }
    })
  })

  test('replaces the notes of a draft carrying the version with the ones generated against main', async ({
    expect,
    scratch
  }) => {
    expect(await cut(scratch, { pages: [[release(false, '0.1.0'), release(true, VERSION)]] })).toEqual({
      calls   : [LISTING, GENERATE, EDIT],
      outputs : { state: 'refreshed', url: ADDRESS, version: VERSION },
      status  : 0,
      stderr  : '',
      stdout  : `Replaced the notes of the draft release for version ${VERSION} at ${ADDRESS}\n`
    })
  })

  test.for([
    { order: 'after a draft', pages: [[release(true, VERSION), release(false, VERSION)]] },
    { order: 'before a draft', pages: [[release(false, VERSION), release(true, VERSION)]] },
    { order: 'with no draft', pages: [[release(false, VERSION)]] }
  ])(
    'fails naming `mise bump` where a published release carrying the version is listed $order',
    async ({ pages }, { expect, scratch }) => {
      expect(await cut(scratch, { pages })).toEqual({
        calls   : [LISTING],
        outputs : { state: 'published', url: release(false, VERSION).html_url, version: VERSION },
        status  : 1,
        stderr  : '',
        stdout  : `::error::Version ${VERSION} is already published, so run \`mise bump\` to move`
          + ' `version` in `package.json` to the next release\n'
      })
    }
  )

  test('reads a release carrying the version off a later page of the listing', async ({
    expect,
    scratch
  }) => {
    const { calls, outputs } = await cut(scratch, {
      pages: [[release(false, '0.1.1')], [release(false, '0.1.0'), release(true, VERSION)]]
    })

    expect({ calls, outputs }).toEqual({
      calls   : [LISTING, GENERATE, EDIT],
      outputs : { state: 'refreshed', url: ADDRESS, version: VERSION }
    })
  })

  test.for([
    { fail: ENDPOINT, made: [LISTING], name: 'reading the releases' },
    { fail: 'create', made: [LISTING, CREATE], name: 'creating the draft', pages: [[]] },
    { fail: GENERATOR, made: [LISTING, GENERATE], name: 'generating the notes' },
    { fail: 'edit', made: [LISTING, GENERATE, EDIT], name: 'replacing the notes' }
  ])('fails without reporting a state where $name fails', async ({ fail, made, pages }, {
    expect,
    scratch
  }) => {
    const draft                      = [[release(true, VERSION)]]
    const { calls, outputs, status } = await cut(scratch, { fail, pages: pages ?? draft })

    expect({ calls, outputs, status }).toEqual({ calls: made, outputs: { version: VERSION }, status: 1 })
  })

  test('fails before reading a release on a run from a branch other than main', async ({
    expect,
    scratch
  }) => {
    expect(await cut(scratch, { event: 'workflow_dispatch', ref: 'next' })).toEqual({
      calls   : [],
      outputs : {},
      status  : 1,
      stderr  : "A cut from next fails, since the draft's tag lands on main\n",
      stdout  : ''
    })
  })
})
