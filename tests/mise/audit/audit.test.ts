import { join } from 'node:path'

import { expect, vi } from 'vitest'

import { Audit, type Run } from '../../../.mise/audit/audit.ts'
import { mise }            from '../../common/mise.js'
import { plant, test }     from '../../common/scratch.js'

const CONFIG = '[tools]\nnode = "26.10.0"\n'

const manifest = (coverage: string): string => JSON.stringify(
  { devDependencies: { '@vitest/coverage-v8': coverage, vitest: '5.0.3' }, engines: { node: '^26.10.0' } },
  null,
  2
)

test.for([
  { coverage: '5.0.3', status: 0, written: [] },
  {
    coverage : '5.0.4',
    status   : 1,
    written  : [
      '::error file=package.json,line=3,title=Coverage pin::`@vitest/coverage-v8` pins 5.0.4, '
    + 'whereas `vitest`, the release it runs under, pins 5.0.3'
    ]
  }
])('prints each finding and exits $status', async ({ coverage, status, written }, { scratch }) => {
  const write = vi.fn<(line: string) => void>()

  await plant(scratch, { '.mise/config.toml': CONFIG, 'package.json': manifest(coverage) })

  expect(new Audit(scratch, mise([]), write).report()).toBe(status)
  expect(write.mock.calls.flat()).toEqual(written)
})

test('prints a finding against the site’s manifest where the checkout holds one', async ({ scratch }) => {
  const write = vi.fn<(line: string) => void>()

  await plant(scratch, {
    '.mise/config.toml' : CONFIG,
    'package.json'      : manifest('5.0.3'),
    'site/package.json' : manifest('5.0.4')
  })

  new Audit(scratch, mise([]), write).report()

  expect(write.mock.calls.flat()).toEqual([
    '::error file=site/package.json,line=3,title=Coverage pin::`@vitest/coverage-v8` pins 5.0.4, '
  + 'whereas `vitest`, the release it runs under, pins 5.0.3'
  ])
})

test('prints the findings of the workflows and the composite actions', async ({ scratch }) => {
  const write = vi.fn<(line: string) => void>()

  await plant(scratch, {
    '.github/actions/a/action.yml' : 'runs:\n  steps:\n    - &a\n      run: x\n',
    '.github/workflows/ci.yml'     : 'on: pull_request\njobs:\n  a:\n    timeout-minutes: 1\n',
    '.mise/config.toml'            : CONFIG,
    'package.json'                 : manifest('5.0.3')
  })

  expect(new Audit(scratch, mise([]), write).report()).toBe(1)
  expect(write.mock.calls.flat()).toEqual([
    '::error file=.github/actions/a/action.yml,line=4,title=YAML anchor::'
  + '`&a` is a YAML anchor or alias, which GitHub rejects in an action manifest',
    '::error file=.github/workflows/ci.yml,line=1,title=Concurrency::The workflow runs on `pull_request` '
  + 'and sets no `concurrency` group, so a superseded pull-request run keeps running',
    '::error file=.github/workflows/ci.yml,line=3,title=Reading gate::The workflow ends on no `✨ Reading` gate'
  ])
})

test('prints what the label registry and the files naming its labels report', async ({ scratch }) => {
  const write = vi.fn<(line: string) => void>()

  await plant(scratch, {
    '.github/ISSUE_TEMPLATE/spec.md' : '---\nlabels: 🦖 rex\n---\n',
    '.github/labels.toml'            : '["🐞 bug"]\ncolor = "c62d42"\ndescription = "A defect."\n',
    '.github/release.yml'            : 'changelog:\n  categories: []\n',
    '.mise/config.toml'              : CONFIG,
    'package.json'                   : manifest('5.0.3')
  })

  expect(new Audit(scratch, mise([]), write).report()).toBe(1)
  expect(write.mock.calls.flat()).toEqual([
    '::error file=.github/labels.toml,line=3,title=Label description::'
  + 'The description of `🐞 bug` ends on a period',
    '::error file=.github/labels.toml,line=1,title=Release category::'
  + '`🐞 bug` sits in no category of `.github/release.yml`',
    '::error file=.github/ISSUE_TEMPLATE/spec.md,line=2,title=Unknown label::'
  + '`.github/labels.toml` declares no label `🦖 rex`'
  ])
})

test('reads every file matching a pattern, keyed by its path in sorted order', async ({ scratch }) => {
  await plant(scratch, { 'a/x.yml': 'ax', 'a/y.yaml': 'ay', 'b/x.yml': 'bx', 'c.txt': 'c' })

  const files = new Audit(scratch).readAll('*/*.yml', '*/*.yaml')

  expect(Object.entries(files)).toEqual([['a/x.yml', 'ax'], ['a/y.yaml', 'ay'], ['b/x.yml', 'bx']])
})

test('runs mise in the checkout and returns what it prints whatever its exit status', ({ scratch }) => {
  const run = vi.fn<Run>(() => ({ stderr: 'mise ERROR 1 error', stdout: '{ "issues": [] }' }))

  expect(new Audit(scratch, run).mise('tasks', 'validate', '--json')).toBe('{ "issues": [] }')
  expect(run).toHaveBeenCalledExactlyOnceWith('mise', ['tasks', 'validate', '--json'], {
    cwd      : scratch,
    encoding : 'utf8'
  })
})

test('throws what mise printed to standard error where it prints nothing else', ({ scratch }) => {
  const run = vi.fn<Run>(() => ({ stderr: 'mise ERROR Error parsing task file\n', stdout: '' }))

  expect(() => new Audit(scratch, run).mise('tasks', 'ls'))
    .toThrow(new Error('mise ERROR Error parsing task file'))
})

test('throws the error starting mise raised', ({ scratch }) => {
  const error = new Error('spawnSync mise ENOENT')
  const audit = new Audit(scratch, () => ({ error, stderr: '', stdout: '' }))

  expect(() => audit.mise('tasks', 'ls')).toThrow(error)
})

test('reads a file and names a path relative to the checkout', async ({ scratch }) => {
  const audit = new Audit(scratch)

  await plant(scratch, { 'package.json': '{}' })

  expect([audit.read('package.json'), audit.relative(join(scratch, '.mise', 'tasks'))])
    .toEqual(['{}', '.mise/tasks'])
})
