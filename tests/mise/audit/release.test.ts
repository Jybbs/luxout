import { expect, it } from 'vitest'

import { Audit }         from '../../../.mise/audit/audit.ts'
import { LabelRegistry } from '../../../.mise/audit/labels.ts'
import { ReleaseNotes }  from '../../../.mise/audit/release.ts'
import { plant, test }   from '../../common/scratch.js'

const registry = new LabelRegistry([
  '["🐞 bug"]',
  'color       = "c62d42"',
  'description = "A defect"',
  '',
  '["📗 docs"]',
  'color       = "8cc5a3"',
  'description = "The README"'
].join('\n'))

const notes = (...categories: string[][]): string => [
  'changelog:',
  '  categories:',
  ...categories.flatMap((labels, index) => [
    `    - title: ${index}`,
    '      labels:',
    ...labels.map((name) => `        - "${name}"`)
  ])
].join('\n')

it('reports nothing where each label sits in one category beside the catch-all', () => {
  expect(new ReleaseNotes(notes(['🐞 bug'], ['📗 docs'], ['*'])).findings(registry)).toEqual([])
})

it('reports a label in no category on the line its registry table opens', () => {
  expect(new ReleaseNotes(notes(['🐞 bug'], ['*'])).findings(registry)).toEqual([expect.objectContaining({
    message : '`📗 docs` sits in no category of `.github/release.yml`',
    spot    : { file: '.github/labels.toml', line: 5 },
    title   : 'Release category'
  })])
})

it('reports each repeat of a label on its own line, past the category that already holds it', () => {
  const text     = notes(['🐞 bug', '📗 docs'], ['🐞 bug'], ['📗 docs', '🐞 bug'])
  const findings = new ReleaseNotes(text).findings(registry)

  expect(findings.map(({ message, spot }) => [spot.file, spot.line, message])).toEqual([
    ['.github/release.yml', 9, '`🐞 bug` already sits in a category above this line'],
    ['.github/release.yml', 13, '`🐞 bug` already sits in a category above this line'],
    ['.github/release.yml', 12, '`📗 docs` already sits in a category above this line']
  ])
})

it('reports a label one category lists twice on its second line', () => {
  expect(new ReleaseNotes(notes(['🐞 bug', '🐞 bug', '📗 docs'])).findings(registry)).toMatchObject([
    { message: '`🐞 bug` already sits in a category above this line', spot: { line: 6 } }
  ])
})

it('reports each label a category or an exclusion names that the registry lacks, on its own line', () => {
  const text = [
    'changelog:',
    '  exclude:',
    '    labels:',
    '      - 🙈 skip',
    '  categories:',
    '    - title: Fixes',
    '      labels:',
    '        - 🐛 bug',
    '        - 🐞 bug',
    '        - 📗 docs',
    '      exclude:',
    '        labels:',
    '          - 🙊 hush'
  ].join('\n')

  expect(new ReleaseNotes(text).findings(registry).map(({ message, spot }) => [spot.line, message])).toEqual([
    [8, '`.github/labels.toml` declares no label `🐛 bug`'],
    [4, '`.github/labels.toml` declares no label `🙈 skip`'],
    [13, '`.github/labels.toml` declares no label `🙊 hush`']
  ])
})

it('reads every label as sitting in no category where the file holds none', () => {
  expect(new ReleaseNotes('').findings(registry).map(({ message }) => message)).toEqual([
    '`🐞 bug` sits in no category of `.github/release.yml`',
    '`📗 docs` sits in no category of `.github/release.yml`'
  ])
})

it('reports a file that fails to parse rather than throwing', () => {
  expect(new ReleaseNotes('changelog:\n  categories: [\n').findings(new LabelRegistry('')))
    .toMatchObject([{ spot: { file: '.github/release.yml' }, title: 'Parse error' }])
})

test('reads the file a checkout holds, and none where it holds no file', async ({ scratch }) => {
  const audit = new Audit(scratch)
  const empty = ReleaseNotes.read(audit).findings(registry).length

  await plant(scratch, { '.github/release.yml': notes(['🐞 bug', '📗 docs']) })

  expect([empty, ReleaseNotes.read(audit).findings(registry)]).toEqual([2, []])
})
