import { describe, expect, it } from 'vitest'

import { Audit }         from '../../../.mise/audit/audit.ts'
import { LabelRegistry } from '../../../.mise/audit/labels.ts'
import { plant, test }   from '../../common/scratch.js'

const bug  = table('🐞 bug', 'c62d42', 'A defect, filed beside the label of the domain where it breaks')
const docs = table('📗 docs', '8cc5a3', 'The README, the docs site, and the contributor guide')

it('reports nothing where every label holds a lowercase color and a description GitHub accepts', () => {
  expect(new LabelRegistry([bug, docs].join('\n')).findings).toEqual([])
})

it('reads each label by its full name on the line its table opens', () => {
  expect(new LabelRegistry([bug, docs].join('\n')).labels.map(({ name, spot }) => ({ name, spot }))).toEqual([
    { name: '🐞 bug', spot: { file: '.github/labels.toml', line: 1 } },
    { name: '📗 docs', spot: { file: '.github/labels.toml', line: 5 } }
  ])
})

it('reads a label written as an inline table like one written as a table', () => {
  expect(new LabelRegistry('"🐞 bug" = { color = "c62d42", description = "A defect" }\n').findings).toEqual([])
})

it.each([
  { key: 'color', text: '["🐞 bug"]\ndescription = "A defect"\n' },
  { key: 'description', text: '["🐞 bug"]\ncolor = "c62d42"\n' }
])('reports a label that declares no $key on the line its table opens', ({ key, text }) => {
  expect(new LabelRegistry('\n' + text).findings).toEqual([
    expect.objectContaining({
      message : `\`🐞 bug\` declares no \`${key}\``,
      spot    : { file: '.github/labels.toml', line: 2 },
      title   : `Label ${key}`
    })
  ])
})

describe('a color', () => {
  it.each(['C62D42', 'c62d4', 'c62d420', '#c62d42', 'g62d42'])('rejects %s on its own line', (color) => {
    expect(new LabelRegistry(table('🐞 bug', color, 'A defect')).findings).toMatchObject([{
      message : `\`🐞 bug\` takes the color \`${color}\`, which is not six lowercase hex digits`,
      spot    : { line: 2 },
      title   : 'Label color'
    }])
  })

  it('reports each label taking a color a label above it already takes, naming the first', () => {
    const shared = [bug, table('📗 docs', 'c62d42', 'The README'), table('⛅ sky', 'C62D42', 'Sky')].join('\n')

    expect(new LabelRegistry(shared).findings.map(({ message, spot }) => [spot.line, message])).toEqual([
      [6, '`📗 docs` takes the color `c62d42`, which `🐞 bug` already takes'],
      [10, '`⛅ sky` takes the color `C62D42`, which is not six lowercase hex digits'],
      [10, '`⛅ sky` takes the color `c62d42`, which `🐞 bug` already takes']
    ])
  })
})

describe('a description', () => {
  it.each([
    { description: 'a'.repeat(100), name: 'a hundred ASCII characters' },
    { description: '🐞'.repeat(50), name: 'fifty astral characters, each counted as two code units' }
  ])('passes $name', ({ description }) => {
    expect(new LabelRegistry(table('🐞 bug', 'c62d42', description)).findings).toEqual([])
  })

  it.each([
    { description: 'a'.repeat(101), length: 101 },
    { description: '🐞'.repeat(51), length: 102 }
  ])('reports one running $length code units on its own line', ({ description, length }) => {
    expect(new LabelRegistry(table('🐞 bug', 'c62d42', description)).findings).toMatchObject([{
      message : `The description of \`🐞 bug\` runs ${length} UTF-16 code units, `
              + 'past the 100 characters GitHub accepts',
      spot    : { line: 3 },
      title   : 'Label description'
    }])
  })

  it('reports one ending on a period', () => {
    expect(new LabelRegistry(table('🐞 bug', 'c62d42', 'A defect.')).findings).toMatchObject([{
      message : 'The description of `🐞 bug` ends on a period',
      spot    : { line: 3 },
      title   : 'Label description'
    }])
  })
})

it('reports two tables sharing a name as the parse error on the second, declaring no label', () => {
  const registry = new LabelRegistry([bug, bug].join('\n'))

  expect({ findings: registry.findings, labels: registry.labels }).toMatchObject({
    findings : [{ spot: { file: '.github/labels.toml', line: 5 }, title: 'Parse error' }],
    labels   : []
  })
})

it('reports each named label the registry does not declare on the line naming it', () => {
  const named = [
    { file: '.github/release.yml', line: 4, value: '🐞 bug' },
    { file: '.github/release.yml', line: 5, value: '🐛 bug' }
  ]

  expect(new LabelRegistry(bug).undeclared(named)).toEqual([expect.objectContaining({
    message : '`.github/labels.toml` declares no label `🐛 bug`',
    spot    : { file: '.github/release.yml', line: 5 },
    title   : 'Unknown label'
  })])
})

test('reads a checkout holding no registry as declaring no label', ({ scratch }) => {
  const registry = LabelRegistry.read(new Audit(scratch))

  expect({ findings: registry.findings, labels: registry.labels }).toEqual({ findings: [], labels: [] })
})

test('reads the registry a checkout holds', async ({ scratch }) => {
  await plant(scratch, { '.github/labels.toml': bug })

  expect(LabelRegistry.read(new Audit(scratch)).labels.map(({ name }) => name)).toEqual(['🐞 bug'])
})

function table(name: string, color: string, description: string): string {
  return `["${name}"]\ncolor       = ${JSON.stringify(color)}\ndescription = ${JSON.stringify(description)}\n`
}
