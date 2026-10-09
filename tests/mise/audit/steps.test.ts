import { describe, expect, it } from 'vitest'

import { YamlFile }     from '../../../.mise/audit/files.ts'
import { Step, pinned } from '../../../.mise/audit/steps.ts'

const COMMIT = '3d3c42e5aac5ba805825da76410c181273ba90b1'
const OTHER  = '2d8d4cafcbd33be2ea37d2b6f5ad595363d1f1ca'

const STEPS = [
  'steps:',
  '  - name : Check out',
  `    uses : actions/checkout@${COMMIT}`,
  '    with:',
  '      fetch-depth         : 2',
  '      persist-credentials : false',
  '',
  '  - name : Summarize',
  '    run  : echo done >> "$GITHUB_STEP_SUMMARY"'
].join('\n')

const uses = (file: string, line: number, value: string, comment?: string) => ({ comment, file, line, value })

describe('Step', () => {
  const file                  = new YamlFile('ci.yml', STEPS)
  const [checkout, summarize] = Step.list(file, 'steps')

  it('reads each step of the sequence at a path, and none where no sequence sits there', () => {
    expect([Step.list(file, 'steps').length, Step.list(file, 'jobs')]).toEqual([2, []])
  })

  it('finds the action a step names, and nothing for a step that runs a script', () => {
    expect([checkout?.uses, summarize?.uses])
      .toEqual([{ file: 'ci.yml', line: 3, value: `actions/checkout@${COMMIT}` }, undefined])
  })

  it('finds each input a step passes through `with`, valued by its name on its line', () => {
    expect([checkout?.inputs, summarize?.inputs]).toEqual([
      [
        { file: 'ci.yml', line: 5, value: 'fetch-depth' },
        { file: 'ci.yml', line: 6, value: 'persist-credentials' }
      ],
      []
    ])
  })

  it('reports the script a step runs only where it writes the step summary', () => {
    expect([checkout?.findings, summarize?.findings]).toMatchObject([
      [],
      [{ spot: { file: 'ci.yml', line: 9 }, title: 'Step summary' }]
    ])
  })
})

describe('pinned', () => {
  it('reports nothing where every action keeps one commit and no pin is followed by a comment', () => {
    expect(pinned([
      uses('ci.yml', 3, `actions/checkout@${COMMIT}`),
      uses('release.yml', 8, `actions/checkout@${COMMIT}`),
      uses('ci.yml', 9, './.github/actions/provision'),
      uses('ci.yml', 10, '$/.github/actions/provision'),
      uses('ci.yml', 11, 'docker://alpine@sha256:abc')
    ])).toEqual([])
  })

  it('reports each pin of an action whose commit differs from the first pin of that action', () => {
    expect(pinned([
      uses('ci.yml', 3, `actions/checkout@${COMMIT}`),
      uses('ci.yml', 9, `jdx/mise-action@${OTHER}`),
      uses('release.yml', 8, `actions/checkout@${OTHER}`)
    ])).toMatchObject([{
      message : `\`actions/checkout\` pins ${OTHER}, whereas ci.yml:3 pins ${COMMIT}`,
      spot    : { file: 'release.yml', line: 8 },
      title   : 'Action pin'
    }])
  })

  it('holds the actions under one repository to one commit', () => {
    expect(pinned([
      uses('ci.yml', 3, `github/codeql-action/init@${COMMIT}`),
      uses('ci.yml', 9, `github/codeql-action/analyze@${OTHER}`)
    ])).toMatchObject([{
      message: `\`github/codeql-action\` pins ${OTHER}, whereas ci.yml:3 pins ${COMMIT}`
    }])
  })

  it('reports a comment trailing a pin on the pin’s line', () => {
    expect(pinned([uses('ci.yml', 3, `actions/checkout@${COMMIT}`, ' v7.0.1')])).toMatchObject([{
      message : `\`actions/checkout@${COMMIT}\` is followed by the comment \`v7.0.1\`, `
              + 'which nothing holds to the commit',
      spot    : { file: 'ci.yml', line: 3 }
    }])
  })
})
