import { readFile } from 'node:fs/promises'
import { join }     from 'node:path'

import { describe, expect } from 'vitest'

import { type Call, type SyncRun, confirm, sync } from '../../../../common/sync.js'
import { plant, test }                            from '../../../../common/scratch.js'

const MANIFEST = JSON.stringify({
  description : 'A light sensor',
  keywords    : ['homebridge-plugin', 'supports-hap']
})

const OWN = [
  '.github/rulesets/main.json', '.github/rulesets/tags.json', '.github/settings.toml', 'package.json'
]

const RULESETS = 'repos/{owner}/{repo}/rulesets'

const SETTINGS = [
  '[graphql.updateRepository]',
  'hasDiscussionsEnabled = false',
  '',
  '["repos/{owner}/{repo}"]',
  'has_wiki = false',
  '',
  '["repos/{owner}/{repo}/actions/permissions/workflow"]',
  'can_approve_pull_request_reviews = false',
  'default_workflow_permissions     = "read"',
  '',
  '["repos/{owner}/{repo}/automated-security-fixes"]',
  'enabled = false',
  '',
  '["repos/{owner}/{repo}/immutable-releases"]',
  'enabled = true'
].join('\n')

const TOPICS  = { names: ['homebridge-plugin'] }
const LISTING = { args: ['api', '--jq', '.[].name', '--paginate', RULESETS], body: null }

/**
 * Runs the task over `files` in `scratch` beside a manifest naming a
 * description and the topics, passing `options` to the stand-in `gh`.
 */
async function rulesets(
  files   : Record<string, string>,
  scratch : string,
  options : Parameters<typeof sync>[2] = {}
): Promise<SyncRun> {
  await plant(scratch, { 'package.json': MANIFEST, ...files })

  return sync(scratch, 'repo:sync:rulesets', options)
}

const send = (method: string, endpoint: string, body?: object, input = '-'): Call => ({
  args : ['api', ...body ? ['--input', input] : [], '--method', method, '--silent', endpoint],
  body : body ?? null
})

describe('the rulesets', () => {
  const main = { name: 'main branch protection', target: 'branch' }
  const tags = { name: 'release tag protection', target: 'tag' }

  const files = {
    '.github/rulesets/main.json' : JSON.stringify(main),
    '.github/rulesets/tags.json' : JSON.stringify(tags),
    '.github/settings.toml'      : ''
  }

  test('renames in place the live ruleset its file is named for, or creates one', async ({ scratch }) => {
    const { calls, status } = await rulesets(files, scratch, {
      live: { [RULESETS]: [[{ id: 7, name: 'main' }, { id: 8, name: 'release' }]] }
    })

    expect({ calls: calls.slice(0, 3), status }).toEqual({
      status : 0,
      calls  : [
        { args: ['api', '--paginate', RULESETS], body: null },
        send('PUT', `${RULESETS}/7`, main, '.github/rulesets/main.json'),
        send('POST', RULESETS, tags, '.github/rulesets/tags.json')
      ]
    })
  })

  test('creates every ruleset where GitHub holds none', async ({ scratch }) => {
    const { calls } = await rulesets(files, scratch)

    expect(calls.slice(1, 3)).toEqual([
      send('POST', RULESETS, main, '.github/rulesets/main.json'),
      send('POST', RULESETS, tags, '.github/rulesets/tags.json')
    ])
  })

  test('prefers the live ruleset carrying the file’s name to one named for the file', async ({ scratch }) => {
    const { calls } = await rulesets(files, scratch, {
      live: { [RULESETS]: [[{ id: 7, name: 'main' }, { id: 9, name: 'main branch protection' }]] }
    })

    expect(calls[1]).toEqual(send('PUT', `${RULESETS}/9`, main, '.github/rulesets/main.json'))
  })

  test('finds a live ruleset on any page of the listing', async ({ scratch }) => {
    const { calls } = await rulesets(files, scratch, {
      live: { [RULESETS]: [[{ id: 1, name: 'other' }], [{ id: 2, name: 'tags' }]] }
    })

    expect(calls[2]).toEqual(send('PUT', `${RULESETS}/2`, tags, '.github/rulesets/tags.json'))
  })

  test('lists each live ruleset no file names rather than deleting it', async ({ scratch }) => {
    const pages = [
      [{ id: 1, name: 'main branch protection' }, { id: 2, name: 'legacy' }],
      [{ id: 3, name: 'x' }]
    ]

    const { calls, stdout } = await rulesets(files, scratch, { live: { [RULESETS]: pages } })

    expect({ last: calls.at(-1), stdout }).toEqual({
      last   : LISTING,
      stdout : 'GitHub holds rulesets no file declares, left in place:\n  legacy\n  x\n'
    })
  })

  test('sends no setting once a ruleset fails to apply', async ({ scratch }) => {
    const { calls, status } = await rulesets(files, scratch, {
      fail : 'PUT',
      live : { [RULESETS]: [[{ id: 7, name: 'main' }]] }
    })

    expect({ endpoints: calls.map(({ args }) => args.at(-1)), failed: status !== 0 })
      .toEqual({ endpoints: [RULESETS, `${RULESETS}/7`], failed: true })
  })
})

describe('the settings', () => {
  const ruleset = { '.github/rulesets/main.json': '{ "name": "main" }' }

  test('sends every table the file declares to its endpoint, with its body', async ({ scratch }) => {
    const { calls, status } = await rulesets({ ...ruleset, '.github/settings.toml': SETTINGS }, scratch, {
      live: { 'repos/{owner}/{repo}': { node_id: 'R_1' }, [RULESETS]: [[{ id: 7, name: 'main' }]] }
    })

    expect({ calls: calls.slice(2), status }).toEqual({
      status : 0,
      calls  : [
        send('PATCH', 'repos/{owner}/{repo}', { description: 'A light sensor', has_wiki: false }),
        send('PUT', 'repos/{owner}/{repo}/topics', TOPICS),
        send('PUT', 'repos/{owner}/{repo}/actions/permissions/workflow', {
          can_approve_pull_request_reviews : false,
          default_workflow_permissions     : 'read'
        }),
        send('DELETE', 'repos/{owner}/{repo}/automated-security-fixes'),
        send('PUT', 'repos/{owner}/{repo}/immutable-releases'),
        { args: ['api', '--jq', '.node_id', 'repos/{owner}/{repo}'], body: null },
        send('POST', 'graphql', {
          query     : 'mutation($input: UpdateRepositoryInput!) { updateRepository(input: $input) '
                    + '{ clientMutationId } }',
          variables : { input: { hasDiscussionsEnabled: false, repositoryId: 'R_1' } }
        }),
        LISTING
      ]
    })
  })

  test('sends the description and the topics where the file declares no table', async ({ scratch }) => {
    const { calls } = await rulesets({ ...ruleset, '.github/settings.toml': '' }, scratch)

    expect(calls.slice(2, 4)).toEqual([
      send('PATCH', 'repos/{owner}/{repo}', { description: 'A light sensor' }),
      send('PUT', 'repos/{owner}/{repo}/topics', TOPICS)
    ])
  })

  test.for([
    { name: 'an empty table the schema leaves out', named: 'pages', text: '[pages]' },
    { name: 'a key the schema leaves out', named: 'graphql.x', text: '[graphql]\nx = 1' },
    {
      name  : 'a table the schema leaves out',
      named : 'repos/{owner}/{repo}/pages',
      text  : '["repos/{owner}/{repo}/pages"]\ncname = "luxout.fyi"'
    },
    {
      name  : 'a key the schema leaves out inside a nested table',
      named : 'repos/{owner}/{repo}.security_and_analysis.secret_scaning',
      text  : '["repos/{owner}/{repo}".security_and_analysis]\nsecret_scaning = { status = "enabled" }'
    },
    {
      name  : 'a value of the wrong type',
      named : 'repos/{owner}/{repo}.has_wiki',
      text  : '["repos/{owner}/{repo}"]\nhas_wiki = "no"'
    },
    {
      name  : 'a table where a value belongs',
      named : 'repos/{owner}/{repo}.has_wiki',
      text  : '["repos/{owner}/{repo}"]\nhas_wiki = { status = "enabled" }'
    }
  ])('sends nothing where the file declares $name', async ({ named, text }, { scratch }) => {
    const { calls, status, stderr } = await rulesets({ ...ruleset, '.github/settings.toml': text }, scratch)

    expect({ calls, named: stderr.includes(`\n  ${named}\n`), status })
      .toEqual({ calls: [], named: true, status: 1 })
  })

  test('sends no further setting once one fails to send', async ({ scratch }) => {
    const { calls, status } = await rulesets({ ...ruleset, '.github/settings.toml': SETTINGS }, scratch, {
      fail: 'PATCH'
    })

    expect({ endpoints: calls.map(({ args }) => args.at(-1)), failed: status !== 0 })
      .toEqual({ endpoints: [RULESETS, RULESETS, 'repos/{owner}/{repo}'], failed: true })
  })

  test('sends nothing where the file fails to parse', async ({ scratch }) => {
    const { calls, status } = await rulesets(
      { ...ruleset, '.github/settings.toml': 'has_wiki = [\n' },
      scratch
    )

    expect({ calls, failed: status !== 0 }).toEqual({ calls: [], failed: true })
  })
})

test('sends the repository’s own rulesets and settings, each to its endpoint', async ({ scratch }) => {
  const root  = join(import.meta.dirname, '..', '..', '..', '..', '..')
  const files = await Promise.all(OWN.map(async (file) => [file, await readFile(join(root, file), 'utf8')]))

  const { calls, status } = await rulesets(Object.fromEntries(files), scratch, {
    live: {
      'repos/{owner}/{repo}' : { node_id: 'R_1' },
      [RULESETS]             : [[{ id: 1, name: 'main' }, { id: 2, name: 'tags' }]]
    }
  })

  expect({ commands: calls.map(({ args }) => args.join(' ')), status }).toMatchInlineSnapshot(`
    {
      "commands": [
        "api --paginate repos/{owner}/{repo}/rulesets",
        "api --input .github/rulesets/main.json --method PUT --silent repos/{owner}/{repo}/rulesets/1",
        "api --input .github/rulesets/tags.json --method PUT --silent repos/{owner}/{repo}/rulesets/2",
        "api --input - --method PATCH --silent repos/{owner}/{repo}",
        "api --input - --method PUT --silent repos/{owner}/{repo}/topics",
        "api --input - --method PUT --silent repos/{owner}/{repo}/actions/permissions",
        "api --input - --method PUT --silent repos/{owner}/{repo}/actions/permissions/fork-pr-contributor-approval",
        "api --input - --method PUT --silent repos/{owner}/{repo}/actions/permissions/workflow",
        "api --method DELETE --silent repos/{owner}/{repo}/automated-security-fixes",
        "api --method PUT --silent repos/{owner}/{repo}/immutable-releases",
        "api --method PUT --silent repos/{owner}/{repo}/private-vulnerability-reporting",
        "api --method PUT --silent repos/{owner}/{repo}/vulnerability-alerts",
        "api --jq .node_id repos/{owner}/{repo}",
        "api --input - --method POST --silent graphql",
        "api --jq .[].name --paginate repos/{owner}/{repo}/rulesets",
      ],
      "status": 0,
    }
  `)
})

test('asks before writing when run as rulesets, failing with no terminal to answer', async ({ scratch }) => {
  expect(await confirm('rulesets', scratch, 'repo:sync:rulesets')).toEqual({ asked: true, status: 1 })
}, 30_000)
