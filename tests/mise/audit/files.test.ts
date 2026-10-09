import { describe, expect, it } from 'vitest'

import { TomlFile, YamlFile } from '../../../.mise/audit/files.ts'

const JSON_TEXT = JSON.stringify(
  { devDependencies: { vitest: '5.0.3' }, engines: { node: '^26.10.0' } },
  null,
  2
)

const TOML = [
  'min_version = "2026.9.18"',
  '',
  '[tools]',
  'node = "26.10.0"',
  '',
  '["repo:verify"]',
  'run = [',
  '  "mise doctor project",',
  '  """',
  'bun install',
  '""",',
  '  """bun',
  'install""",',
  '  { tasks = ["lock:check"] }',
  ']',
  'env.CI = "1"'
].join('\n')

describe('TomlFile', () => {
  const file = new TomlFile('.mise/config.toml', TOML)

  it.each([
    { line: 1, path: ['min_version'], value: '2026.9.18' },
    { line: 3, path: ['tools'], value: { node: '26.10.0' } },
    { line: 4, path: ['tools', 'node'], value: '26.10.0' },
    { line: 16, path: ['repo:verify', 'env', 'CI'], value: '1' }
  ])('finds $path on line $line', ({ line, path, value }) => {
    expect(file.at(...path)).toEqual({ file: '.mise/config.toml', line, value })
  })

  it('finds nothing at a path no table or key spells', () => {
    expect(file.at('tools', 'bun')).toBeUndefined()
  })

  it.each([
    { line: 8, name: 'a one-line string', text: 'mise doctor project' },
    { line: 10, name: 'a multi-line string past the newline its delimiter opens on', text: 'bun install\n' },
    { line: 12, name: 'a multi-line string whose text shares its delimiter’s line', text: 'bun\ninstall' },
    { line: undefined, name: 'no string', text: 'mise lock' }
  ])('finds the line $name starts on', ({ line, text }) => {
    expect(file.lineOf(text)).toBe(line)
  })

  it('holds a parse error as a finding on its line and finds nothing in the file', () => {
    const broken = new TomlFile('.mise/config.toml', '[tools]\nnode = [\n')

    expect(broken.errors).toMatchObject([
      { spot: { file: '.mise/config.toml', line: 3 }, title: 'Parse error' }
    ])
    expect([broken.at('tools'), broken.lineOf('26.10.0')]).toEqual([undefined, undefined])
  })
})

describe('YamlFile', () => {
  const file = new YamlFile('package.json', JSON_TEXT)

  it.each([
    { line: 3, path: ['devDependencies', 'vitest'], value: '5.0.3' },
    { line: 5, path: ['engines'], value: { node: '^26.10.0' } }
  ])('finds $path on line $line', ({ line, path, value }) => {
    expect(file.at(...path)).toEqual({ file: 'package.json', line, value })
  })

  it('finds nothing at a path no key spells and reports no error on a well-formed file', () => {
    expect([file.at('devDependencies', 'yaml'), file.errors]).toEqual([undefined, []])
  })

  it('holds each parse error as a finding on its line', () => {
    const broken = new YamlFile('package.json', '{\n  "engines": {\n    "node": "^26.10.0"\n}\n')

    expect(broken.errors).toMatchObject([{ spot: { file: 'package.json', line: 5 }, title: 'Parse error' }])
  })

  it('finds each key of a mapping on its own line, and none at a sequence or a missing path', () => {
    const workflow = new YamlFile('ci.yml', 'jobs:\n  check:\n    steps: []\n  brief:\n    needs: [check]\n')

    expect([workflow.keys('jobs'), workflow.keys('jobs', 'brief', 'needs'), workflow.keys('on')]).toEqual([
      [{ file: 'ci.yml', line: 2, value: 'check' }, { file: 'ci.yml', line: 4, value: 'brief' }],
      [],
      []
    ])
  })

  it('finds the comment trailing a value beside the value', () => {
    const action = new YamlFile('action.yml', 'runs:\n  uses: actions/checkout@abc  # v7.0.1\n')

    expect(action.at('runs', 'uses')).toEqual({
      comment : ' v7.0.1',
      file    : 'action.yml',
      line    : 2,
      value   : 'actions/checkout@abc'
    })
  })

  it('finds each alias on its line and each anchor on the line of the node it marks', () => {
    const action = new YamlFile('action.yml', 'steps:\n  - &step\n    run: echo\n  - *step\n  - run: echo\n')

    expect([action.anchors, file.anchors]).toEqual([
      [{ file: 'action.yml', line: 3, value: '&step' }, { file: 'action.yml', line: 4, value: '*step' }],
      []
    ])
  })
})
