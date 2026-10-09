import { expect, it } from 'vitest'

import { Actions }     from '../../../.mise/audit/actions.ts'
import { Audit }       from '../../../.mise/audit/audit.ts'
import { plant, test } from '../../common/scratch.js'

const MANIFEST = '.github/actions/provision/action.yml'

const PROVISION = [
  'name: Provision',
  'inputs:',
  '  tools:',
  '    required: true',
  'runs:',
  '  using: composite',
  '  steps:',
  '    - uses: jdx/mise-action@2d8d4cafcbd33be2ea37d2b6f5ad595363d1f1ca',
  '      with:',
  '        install_args: ${{ inputs.tools }}'
].join('\n')

const ACTIONS = new Actions({ [MANIFEST]: PROVISION })

it('reports nothing on a manifest with no anchor and no step writing the step summary', () => {
  expect(ACTIONS.findings).toEqual([])
})

it.each([
  {
    expected : [{ message: '`&step` is a YAML anchor or alias, which GitHub rejects in an action manifest' }],
    name     : 'an anchor',
    text     : PROVISION.replace('    - uses', '    - &step\n      uses')
  },
  {
    expected : [{ spot: { file: MANIFEST, line: 11 }, title: 'Step summary' }],
    name     : 'a step writing the step summary',
    text     : `${PROVISION}\n    - run: echo done >> "$GITHUB_STEP_SUMMARY"\n      shell: bash`
  }
])('reports $name', ({ expected, text }) => {
  expect(new Actions({ [MANIFEST]: text }).findings).toMatchObject(expected)
})

it('reports a manifest that fails to parse rather than throwing', () => {
  expect(new Actions({ [MANIFEST]: 'runs: [\n' }).findings)
    .toContainEqual(expect.objectContaining({ title: 'Parse error' }))
})

it('finds the action each step of every manifest names', () => {
  expect(ACTIONS.pins).toEqual([{
    file  : MANIFEST,
    line  : 8,
    value : 'jdx/mise-action@2d8d4cafcbd33be2ea37d2b6f5ad595363d1f1ca'
  }])
})

it.each([
  { inputs: new Set(['tools']), uses: '$/.github/actions/provision' },
  { inputs: new Set(['tools']), uses: './.github/actions/provision' },
  { inputs: undefined, uses: './.github/actions/missing' },
  { inputs: undefined, uses: 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1' }
])('finds the inputs the manifest `$uses` names declares', ({ inputs, uses }) => {
  expect(ACTIONS.inputs(uses)).toEqual(inputs)
})

test('reads every manifest under .github/actions/ from the checkout', async ({ scratch }) => {
  await plant(scratch, {
    '.github/actions/a/action.yml'  : 'runs:\n  steps:\n    - uses: a/a@1\n',
    '.github/actions/b/action.yaml' : 'runs:\n  steps:\n    - uses: b/b@2\n',
    '.github/actions/c.yml'         : 'runs:\n  steps:\n    - uses: c/c@3\n'
  })

  expect(Actions.read(new Audit(scratch)).pins.map(({ value }) => value)).toEqual(['a/a@1', 'b/b@2'])
})
