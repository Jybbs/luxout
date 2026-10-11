import { join } from 'node:path'

import { expect } from 'vitest'

import { Audit }           from '../../../.mise/audit/audit.ts'
import { Rulesets }        from '../../../.mise/audit/rulesets.ts'
import { GATE, Workflows } from '../../../.mise/audit/workflows.ts'
import { plant, test }     from '../../common/scratch.js'

const FILE = '.github/rulesets/main.json'

const audit = (ruleset: string, workflows: Record<string, string> = { 'ci.yml': workflow('pull_request') }) =>
  new Rulesets({ [FILE]: ruleset }).findings(new Workflows(workflows))

const checks = (...contexts: string[]): string => JSON.stringify(
  {
    name  : 'main branch protection',
    rules : [
      { type: 'deletion' },
      {
        type       : 'required_status_checks',
        parameters : {
          required_status_checks: contexts.map((context) => ({ context, integration_id: 15368 }))
        }
      }
    ]
  },
  null,
  2
)

const workflow = (on: string): string =>
  `on: ${on}\njobs:\n  check:\n    runs-on: ubuntu-26.04\n  brief:\n    name: ${GATE}\n    needs: [check]\n`

test('reports nothing where the branch ruleset requires the gate a pull request reports', () => {
  expect(audit(checks(GATE))).toEqual([])
})

test('reports a required check that is no gate', () => {
  expect(audit(checks(GATE, 'build'))).toEqual([{
    message : '`main branch protection` requires the check `build`, '
            + 'which is not the gate of any workflow that runs on `pull_request`',
    spot    : { file: FILE, line: 16 },
    title   : 'Required check'
  }])
})

test.for([
  { line: 3, name: 'no check', ruleset: checks() },
  { line: 1, name: 'no rule at all', ruleset: '{ "name": "main branch protection", "rules": [] }' },
  {
    line    : 1,
    name    : 'nothing, with no rules key',
    ruleset : JSON.stringify({ name: 'main branch protection' }, null, 2)
  }
])('reports the gate a ruleset requiring $name leaves out', ({ line, ruleset }) => {
  expect(audit(ruleset)).toEqual([{
    message : `\`main branch protection\` does not require \`${GATE}\`, the gate \`ci.yml\` ends on`,
    spot    : { file: FILE, line },
    title   : 'Required check'
  }])
})

test('reports the check a renamed gate leaves behind and the gate the ruleset now lacks', () => {
  expect(audit(checks('Brief')).map(({ message, spot }) => [spot.line, message])).toEqual([
    [
      12,
      '`main branch protection` requires the check `Brief`, '
    + 'which is not the gate of any workflow that runs on `pull_request`'
    ],
    [3, `\`main branch protection\` does not require \`${GATE}\`, the gate \`ci.yml\` ends on`]
  ])
})

test.for([
  { name: 'in a list', on: '[pull_request, workflow_dispatch]' },
  { name: 'as a key', on: '\n  pull_request:\n  workflow_dispatch:' }
])('reads the gate of a workflow naming pull_request $name', ({ on }) => {
  expect(audit(checks(GATE), { 'ci.yml': workflow(on) })).toEqual([])
})

test.for<{ name: string, workflows: Record<string, string> }>([
  {
    name      : 'no pull request runs',
    workflows : { 'draft.yml': workflow('push'), 'release.yml': workflow('release') }
  },
  {
    name      : 'ending on no gate',
    workflows : { 'ci.yml': 'on: pull_request\njobs:\n  check:\n    runs-on: ubuntu-26.04\n' }
  }
])('reads no gate from a workflow $name', ({ workflows }) => {
  expect(audit(checks(GATE), workflows))
    .toMatchObject([{ message: expect.stringContaining(`requires the check \`${GATE}\``) }])
})

test('takes one required check for the gate each pull-request workflow ends on', () => {
  expect(audit(checks(GATE), { 'ci.yml': workflow('pull_request'), 'docs.yml': workflow('pull_request') }))
    .toEqual([])
})

test('reads past a required check that names no context', () => {
  const rules = [{
    parameters : { required_status_checks: [{ integration_id: 15368 }, { context: GATE }] },
    type       : 'required_status_checks'
  }]

  expect(audit(JSON.stringify({ name: 'main branch protection', rules }))).toEqual([])
})

test.for(['tag', 'push'])('holds a %s ruleset to no gate', (target) => {
  expect(audit(JSON.stringify({ name: 'release tag protection', rules: [], target }))).toEqual([])
})

test('reports a ruleset that fails to parse rather than throwing', () => {
  expect(audit('{ "name": ')).toMatchObject([{ spot: { file: FILE, line: 1 }, title: 'Parse error' }])
})

test('reports nothing on the repository’s own rulesets and the workflows they protect', () => {
  const checkout = new Audit(join(import.meta.dirname, '..', '..', '..'))

  expect(Rulesets.read(checkout).findings(Workflows.read(checkout))).toEqual([])
})

test('reads every ruleset under .github/rulesets/ from the checkout', async ({ scratch }) => {
  await plant(scratch, { [FILE]: checks('build'), '.github/rulesets/x.yml': checks('build') })

  expect(Rulesets.read(new Audit(scratch)).findings(new Workflows({})).map(({ spot }) => spot))
    .toEqual([{ file: FILE, line: 12 }])
})
