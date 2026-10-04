import { join } from 'node:path'

import { describe, expect, vi } from 'vitest'

import { Audit, type Run } from '../../../.mise/audit/audit.ts'
import { TaskList }        from '../../../.mise/audit/tasks.ts'
import { plant, test }     from '../../common/scratch.js'

const FRONTMATTER = '#!/usr/bin/env -S bash -euo pipefail\n#MISE description = "Install"\n\n'

const listing = (root: string, tasks: { file?: boolean, name: string, run?: string[], source: string }[]) =>
  tasks.map(({ file = false, name, run = [], source }) => ({
    file   : file ? join(root, source) : null,
    name   : name,
    run    : run,
    source : join(root, source)
  }))

const mise = (listed: object[], issues: object[] = []): Run =>
  vi.fn<Run>((_, [, verb]) => ({ stderr: '', stdout: JSON.stringify(verb === 'ls' ? listed : { issues }) }))

describe('a bun install a task runs', () => {
  test.for([
    { flagged: true, script: 'bun install' },
    { flagged: true, script: 'bun i --production' },
    { flagged: true, script: 'bun --cwd site install' },
    { flagged: false, script: 'bun --cwd=site install --frozen-lockfile' },
    { flagged: false, script: 'bun install --frozen-lockfile' },
    { flagged: false, script: 'bun install --dry-run --frozen-lockfile' },
    { flagged: false, script: 'bun install --lockfile-only' },
    { flagged: false, script: 'bun add --dev yaml' },
    { flagged: false, script: 'echo "bun install"' }
  ])('reports `$script` as unfrozen: $flagged', async ({ flagged, script }, { scratch }) => {
    await plant(scratch, { '.mise/tasks/plugin/bake': FRONTMATTER + script + '\n' })

    const audit = new Audit(scratch, mise(listing(scratch, [
      { file: true, name: 'plugin:bake', source: '.mise/tasks/plugin/bake' }
    ])))

    expect(TaskList.read(audit).findings).toMatchObject(flagged ? [{
      message : `\`${script}\` runs without \`--frozen-lockfile\` or \`--lockfile-only\``,
      spot    : { file: '.mise/tasks/plugin/bake', line: 4 },
      title   : 'Unfrozen install'
    }] : [])
  })

  test('reports each unfrozen install a task runs on its own line', async ({ scratch }) => {
    await plant(scratch, { '.mise/tasks/plugin/bake': FRONTMATTER + 'bun install\nbun i\n' })

    const audit = new Audit(scratch, mise(listing(scratch, [
      { file: true, name: 'plugin:bake', source: '.mise/tasks/plugin/bake' }
    ])))

    expect(TaskList.read(audit).findings.map(({ spot }) => spot.line)).toEqual([4, 5])
  })

  test('reads the script a TOML task names through file', async ({ scratch }) => {
    await plant(scratch, {
      '.mise/tasks/repo/sync.toml' : '["repo:sync"]\nfile = "scripts/sync.sh"\n',
      'scripts/sync.sh'            : FRONTMATTER + 'bun install\n'
    })

    const audit = new Audit(scratch, mise([{
      file   : 'scripts/sync.sh',
      name   : 'repo:sync',
      run    : [],
      source : join(scratch, '.mise/tasks/repo/sync.toml')
    }]))

    expect(TaskList.read(audit).findings).toMatchObject([{ spot: { file: 'scripts/sync.sh', line: 4 } }])
  })

  test('reads each run on its line inside its own task’s table', async ({ scratch }) => {
    const toml = '["x:a"]\ndescription = "bun install"\nrun = "mise lock"\n\n["x:b"]\nrun = "bun install"\n'

    await plant(scratch, { '.mise/tasks/x.toml': toml })

    const audit = new Audit(scratch, mise(listing(scratch, [
      { name: 'x:a', run: ['mise lock'], source: '.mise/tasks/x.toml' },
      { name: 'x:b', run: ['bun install'], source: '.mise/tasks/x.toml' }
    ])))

    expect(TaskList.read(audit).findings).toMatchObject([{ spot: { file: '.mise/tasks/x.toml', line: 6 } }])
  })

  test('reads each string of a TOML task’s run on the line its command sits', async ({ scratch }) => {
    const toml = '["lock:sync"]\ndescription = "Sync"\nrun = [\n  "mise lock",\n  """\nbun install\n"""\n]\n'

    await plant(scratch, { '.mise/tasks/lock/sync.toml': toml })

    const audit = new Audit(scratch, mise(listing(scratch, [
      { name: 'lock:sync', run: ['mise lock', 'bun install\n'], source: '.mise/tasks/lock/sync.toml' }
    ])))

    expect(TaskList.read(audit).findings).toMatchObject([
      { spot: { file: '.mise/tasks/lock/sync.toml', line: 6 } }
    ])
  })
})

describe('a defect mise tasks validate reports', () => {
  test('lands on the file task it names, beside the details mise gives', async ({ scratch }) => {
    await plant(scratch, { '.mise/tasks/plugin/test': FRONTMATTER + 'vitest run\n' })

    const audit = new Audit(scratch, mise(
      listing(scratch, [{ file: true, name: 'plugin:test', source: '.mise/tasks/plugin/test' }]),
      [{ details: "Referenced in 'depends'", message: "Dependency 'nope' not found", task: 'plugin:test' }]
    ))

    expect(TaskList.read(audit).findings).toMatchObject([{
      message : "Dependency 'nope' not found. Referenced in 'depends'",
      spot    : { file: '.mise/tasks/plugin/test', line: 1 },
      title   : 'Task defect'
    }])
  })

  test('reports a warning mise tasks validate gives as it reports an error', async ({ scratch }) => {
    await plant(scratch, { '.mise/tasks/plugin/test': FRONTMATTER + 'vitest run\n' })

    const audit = new Audit(scratch, mise(
      listing(scratch, [{ file: true, name: 'plugin:test', source: '.mise/tasks/plugin/test' }]),
      [{ details: 'Run mise fmt', message: 'Not formatted', severity: 'warning', task: 'plugin:test' }]
    ))

    expect(TaskList.read(audit).findings).toMatchObject([{ message: 'Not formatted. Run mise fmt' }])
  })

  test.for([
    {
      line   : 3,
      name   : 'repo:verify',
      source : '.mise/tasks/repo/verify.toml',
      toml   : '\n\n["repo:verify"]\nrun = "x"\n'
    },
    {
      line   : 4,
      name   : 'lint',
      source : '.mise/config.toml',
      toml   : '[tools]\nnode = "26.10.0"\n\n[tasks.lint]\nrun = "x"\n'
    }
  ])('lands on the table declaring $name in $source', async ({ line, name, source, toml }, { scratch }) => {
    await plant(scratch, { [source]: toml })

    const audit = new Audit(scratch, mise(
      listing(scratch, [{ name, run: ['x'], source }]),
      [{ details: 'Tasks: a, b', message: "Alias 'x' is used by multiple tasks", task: name }]
    ))

    expect(TaskList.read(audit).findings).toMatchObject([{ spot: { file: source, line } }])
  })
})

test('lists every task the checkout declares through mise, hidden ones included', async ({ scratch }) => {
  const run = mise([])

  TaskList.read(new Audit(scratch, run))

  expect(vi.mocked(run).mock.calls.map(([, args]) => args)).toEqual([
    ['tasks', 'validate', '--json'],
    ['tasks', 'ls', '--hidden', '--json', '--local']
  ])
})

test('reports what mise printed where it lists no task rather than throwing', ({ scratch }) => {
  const run = vi.fn<Run>(() => ({ stderr: 'mise ERROR Error parsing task file\n', stdout: '' }))

  expect(TaskList.read(new Audit(scratch, run)).findings).toMatchObject([{
    message : 'Error: mise ERROR Error parsing task file',
    spot    : { file: '.mise/config.toml', line: 1 },
    title   : 'Task listing'
  }])
})
