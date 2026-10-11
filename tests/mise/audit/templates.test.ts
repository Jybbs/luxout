import { expect, it } from 'vitest'

import { Audit }          from '../../../.mise/audit/audit.ts'
import { LabelRegistry }  from '../../../.mise/audit/labels.ts'
import { IssueTemplates } from '../../../.mise/audit/templates.ts'
import { plant, test }    from '../../common/scratch.js'

const SPEC     = '.github/ISSUE_TEMPLATE/spec.md'
const registry = new LabelRegistry('["🐞 bug"]\ncolor = "c62d42"\ndescription = "A defect"\n')

const lines = (files: Record<string, string>): (number | string)[][] =>
  new IssueTemplates(files).findings(registry).map(({ message, spot }) => [spot.file, spot.line, message])

it.each([
  { labels: 'labels: 🐞 bug, 🐛 bug', name: 'in one comma-separated string' },
  { labels: 'labels: ["🐞 bug", "🐛 bug"]', name: 'in a list' }
])('reports a label the registry lacks that a Markdown template’s front matter names $name', ({ labels }) => {
  expect(lines({ [SPEC]: `---\nname: Spec\n${labels}\n---\n\nA lead.\n` })).toEqual([
    [SPEC, 3, '`.github/labels.toml` declares no label `🐛 bug`']
  ])
})

it('reports each label an issue form lists that the registry lacks on its own line', () => {
  const form = '.github/ISSUE_TEMPLATE/bug.yml'

  expect(lines({ [form]: 'name: Bug\nlabels:\n  - 🐞 bug\n  - 🦖 rex\n' })).toEqual([
    [form, 4, '`.github/labels.toml` declares no label `🦖 rex`']
  ])
})

it.each([
  { name: 'an empty labels string', text: '---\nname: Spec\nlabels: \'\'\n---\n' },
  { name: 'a body past the front matter', text: '---\nname: Spec\n---\nlabels: 🦖 rex\n---\n' },
  { name: 'no front matter', text: 'labels: 🦖 rex\n' },
  { name: 'front matter ending on a four-dash line', text: '---\nlabels: 🦖 rex\n----\n' }
])('reads no label from a Markdown template with $name', ({ text }) => {
  expect(lines({ [SPEC]: text })).toEqual([])
})

it('reads no label from the chooser’s config.yml', () => {
  expect(lines({ '.github/ISSUE_TEMPLATE/config.yml': 'blank_issues_enabled: false\n' })).toEqual([])
})

it('reports a template that fails to parse rather than throwing', () => {
  expect(new IssueTemplates({ [SPEC]: '---\nlabels: [\n---\n' }).findings(registry))
    .toMatchObject([{ spot: { file: SPEC }, title: 'Parse error' }])
})

test('reads each Markdown and YAML template under .github/ISSUE_TEMPLATE/ alone', async ({ scratch }) => {
  await plant(scratch, {
    '.github/ISSUE_TEMPLATE/a.yaml'      : 'labels: 🦖 a\n',
    '.github/ISSUE_TEMPLATE/b.yml'       : 'labels: 🦖 b\n',
    '.github/ISSUE_TEMPLATE/c.md'        : '---\nlabels: 🦖 c\n---\n',
    '.github/ISSUE_TEMPLATE/d.txt'       : 'labels: 🦖 d\n',
    '.github/ISSUE_TEMPLATE/nested/e.md' : '---\nlabels: 🦖 e\n---\n',
    '.github/labels.yml'                 : 'labels: 🦖 f\n'
  })

  expect(IssueTemplates.read(new Audit(scratch)).findings(registry).map(({ spot }) => spot.file)).toEqual([
    '.github/ISSUE_TEMPLATE/a.yaml',
    '.github/ISSUE_TEMPLATE/b.yml',
    '.github/ISSUE_TEMPLATE/c.md'
  ])
})
