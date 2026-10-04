import { join } from 'node:path'

import { expect, vi } from 'vitest'

import { Audit, type Run } from '../../../.mise/audit/audit.ts'
import { plant, test }     from '../../common/scratch.js'

const CONFIG     = '[tools]\nnode = "26.10.0"\n'
const EMPTY: Run = (_, [, verb]) => ({ stderr: '', stdout: verb === 'ls' ? '[]' : '{ "issues": [] }' })

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

  expect(new Audit(scratch, EMPTY, write).report()).toBe(status)
  expect(write.mock.calls.flat()).toEqual(written)
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
