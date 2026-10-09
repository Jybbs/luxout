import { join } from 'node:path'

import { describe, expect, vi } from 'vitest'

import { Audit, type Run } from '../../../.mise/audit/audit.ts'
import { PackageManifest } from '../../../.mise/audit/package.ts'
import { TaskList }        from '../../../.mise/audit/tasks.ts'
import { mise }            from '../../common/mise.js'
import { plant, test }     from '../../common/scratch.js'

/**
 * A task a case poses, naming its source relative to the scratch checkout.
 */
interface Declared {
  name   : string
  source : string
  file?  : boolean
  run?   : (string | { tasks: string[] })[]
  tools? : Record<string, string>
}

const FRONTMATTER = '#!/usr/bin/env -S bash -euo pipefail\n#MISE description = "Install"\n\n'
const MANIFEST    = new PackageManifest('{}')

const listing = (root: string, tasks: Declared[]) =>
  tasks.map(({ file = false, name, run = [], source, tools = {} }) => ({
    file   : file ? join(root, source) : null,
    name   : name,
    run    : run,
    source : join(root, source),
    tools  : tools
  }))

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

    expect(TaskList.read(audit).findings(MANIFEST)).toMatchObject(flagged ? [{
      message : `\`${script}\` runs without \`--frozen-lockfile\` or \`--lockfile-only\``,
      spot    : { file: '.mise/tasks/plugin/bake', line: 4 },
      title   : 'Unfrozen install'
    }] : [])
  })

  test('reports an unfrozen install once where several tasks run its script', async ({ scratch }) => {
    await plant(scratch, {
      '.mise/tasks/plugin/lines.toml' : '["plugin:test:22"]\nfile = ".mise/tasks/plugin/test"\n',
      '.mise/tasks/plugin/test'       : FRONTMATTER + 'bun install\n'
    })

    const audit = new Audit(scratch, mise([
      ...listing(scratch, [{ file: true, name: 'plugin:test', source: '.mise/tasks/plugin/test' }]),
      {
        file   : '.mise/tasks/plugin/test',
        name   : 'plugin:test:22',
        run    : [],
        source : join(scratch, '.mise/tasks/plugin/lines.toml'),
        tools  : {}
      }
    ]))

    expect(TaskList.read(audit).findings(MANIFEST))
      .toMatchObject([{ spot: { file: '.mise/tasks/plugin/test', line: 4 }, title: 'Unfrozen install' }])
  })

  test('reports each unfrozen install where two run strings share one line', async ({ scratch }) => {
    await plant(scratch, { '.mise/tasks/x.toml': '["x:a"]\nrun = ["bun install", "bun i"]\n' })

    const audit = new Audit(scratch, mise(listing(scratch, [
      { name: 'x:a', run: ['bun install', 'bun i'], source: '.mise/tasks/x.toml' }
    ])))

    expect(TaskList.read(audit).findings(MANIFEST).map(({ message }) => message)).toEqual([
      '`bun install` runs without `--frozen-lockfile` or `--lockfile-only`',
      '`bun i` runs without `--frozen-lockfile` or `--lockfile-only`'
    ])
  })

  test('reports each unfrozen install a task runs on its own line', async ({ scratch }) => {
    await plant(scratch, { '.mise/tasks/plugin/bake': FRONTMATTER + 'bun install\nbun i\n' })

    const audit = new Audit(scratch, mise(listing(scratch, [
      { file: true, name: 'plugin:bake', source: '.mise/tasks/plugin/bake' }
    ])))

    expect(TaskList.read(audit).findings(MANIFEST).map(({ spot }) => spot.line)).toEqual([4, 5])
  })

  test('reads the script a TOML task’s file names, keeping defects on its table', async ({ scratch }) => {
    await plant(scratch, {
      '.mise/tasks/repo/sync.toml' : '\n["repo:sync"]\nfile = "scripts/sync.sh"\n',
      'scripts/sync.sh'            : FRONTMATTER + 'bun install\n'
    })

    const audit = new Audit(scratch, mise([{
      file   : 'scripts/sync.sh',
      name   : 'repo:sync',
      run    : [],
      source : join(scratch, '.mise/tasks/repo/sync.toml'),
      tools  : {}
    }], [{ message: "Dependency 'nope' not found", task: 'repo:sync' }]))

    expect(TaskList.read(audit).findings(MANIFEST)).toMatchObject([
      { spot: { file: 'scripts/sync.sh', line: 4 }, title: 'Unfrozen install' },
      { message: "Dependency 'nope' not found", spot: { file: '.mise/tasks/repo/sync.toml', line: 2 } }
    ])
  })

  test('reports a file that names no script as mise’s defect rather than throwing', async ({ scratch }) => {
    await plant(scratch, { '.mise/tasks/repo/sync.toml': '["repo:sync"]\nfile = "scripts/missing.sh"\n' })

    const audit = new Audit(scratch, mise([{
      file   : 'scripts/missing.sh',
      name   : 'repo:sync',
      run    : [],
      source : join(scratch, '.mise/tasks/repo/sync.toml'),
      tools  : {}
    }], [{ message: 'Task file not found: scripts/missing.sh', task: 'repo:sync' }]))

    expect(TaskList.read(audit).findings(MANIFEST)).toMatchObject([{
      message : 'Task file not found: scripts/missing.sh',
      spot    : { file: '.mise/tasks/repo/sync.toml', line: 1 }
    }])
  })

  test('reads each run on its line inside its own task’s table', async ({ scratch }) => {
    const toml = '["x:a"]\ndescription = "bun install"\nrun = "mise lock"\n\n'
               + '["x:b"]\ndescription = "bun install"\nrun = "bun install"\n'

    await plant(scratch, { '.mise/tasks/x.toml': toml })

    const audit = new Audit(scratch, mise(listing(scratch, [
      { name: 'x:a', run: ['mise lock'], source: '.mise/tasks/x.toml' },
      { name: 'x:b', run: ['bun install'], source: '.mise/tasks/x.toml' }
    ])))

    expect(TaskList.read(audit).findings(MANIFEST))
      .toMatchObject([{ spot: { file: '.mise/tasks/x.toml', line: 7 } }])
  })

  test('reads each string of a TOML task’s run on the line its command sits', async ({ scratch }) => {
    const toml = '["lock:sync"]\ndescription = "Sync"\nrun = [\n  "mise lock",\n  """\nbun install\n"""\n]\n'

    await plant(scratch, { '.mise/tasks/lock/sync.toml': toml })

    const audit = new Audit(scratch, mise(listing(scratch, [
      { name: 'lock:sync', run: ['mise lock', 'bun install\n'], source: '.mise/tasks/lock/sync.toml' }
    ])))

    expect(TaskList.read(audit).findings(MANIFEST)).toMatchObject([
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

    expect(TaskList.read(audit).findings(MANIFEST)).toMatchObject([{
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

    expect(TaskList.read(audit).findings(MANIFEST))
      .toMatchObject([{ message: 'Not formatted. Run mise fmt' }])
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

    expect(TaskList.read(audit).findings(MANIFEST)).toMatchObject([{ spot: { file: source, line } }])
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

  expect(TaskList.read(new Audit(scratch, run)).findings(MANIFEST)).toMatchObject([{
    message : 'Error: mise ERROR Error parsing task file',
    spot    : { file: '.mise/config.toml', line: 1 },
    title   : 'Task listing'
  }])
})

test('reports the line a task script stops parsing on', async ({ scratch }) => {
  await plant(scratch, { '.mise/tasks/plugin/bake': FRONTMATTER + 'cd {{arg(name="dir")}}\nbun install\n' })

  const audit = new Audit(scratch, mise(listing(scratch, [
    { file: true, name: 'plugin:bake', source: '.mise/tasks/plugin/bake' }
  ])))

  expect(TaskList.read(audit).findings(MANIFEST)).toMatchObject([{
    message : "unexpected token '('",
    spot    : { file: '.mise/tasks/plugin/bake', line: 4 },
    title   : 'Shell syntax'
  }])
})

describe('a Node release a task declares', () => {
  const engines = new PackageManifest(JSON.stringify({ engines: { node: '^22.23.3 || ^24.21.0' } }))
  const toml    = '["plugin:test:22"]\nfile  = ".mise/tasks/plugin/test"\ntools = { node = "22.23.3" }\n'

  test.for([
    { expected: [], node: '22.23.3' },
    {
      node     : '22.23.2',
      expected : [{
        message : '`plugin:test:22` runs on Node 22.23.2, whereas `engines` sets 22.23.3 as the floor '
                + 'of the 22 line',
        spot    : { file: '.mise/tasks/plugin/lines.toml', line: 3 },
        title   : 'Node floor'
      }]
    },
    {
      expected : [{ message: '`engines` admits no Node 20 line for `plugin:test:22` to run on' }],
      node     : '20.19.0'
    }
  ])('holds Node $node to the floor of its line', async ({ expected, node }, { scratch }) => {
    await plant(scratch, {
      '.mise/tasks/plugin/lines.toml' : toml,
      '.mise/tasks/plugin/test'       : FRONTMATTER + 'vitest run\n'
    })

    const audit = new Audit(scratch, mise([{
      file   : '.mise/tasks/plugin/test',
      name   : 'plugin:test:22',
      run    : [],
      source : join(scratch, '.mise/tasks/plugin/lines.toml'),
      tools  : { node }
    }]))

    expect(TaskList.read(audit).findings(engines)).toMatchObject(expected)
  })

  test('holds a task on the newest line to that line’s floor as well', async ({ scratch }) => {
    const newest = new PackageManifest(JSON.stringify({ engines: { node: '^26.10.0' } }))

    await plant(scratch, {
      '.mise/tasks/plugin/lines.toml': '["plugin:test:26"]\ntools = { node = "26.11.1" }\n'
    })

    const audit = new Audit(scratch, mise(listing(scratch, [
      { name: 'plugin:test:26', source: '.mise/tasks/plugin/lines.toml', tools: { node: '26.11.1' } }
    ])))

    expect(TaskList.read(audit).findings(newest)).toMatchObject([{
      message : '`plugin:test:26` runs on Node 26.11.1, whereas `engines` sets 26.10.0 as the floor '
              + 'of the 26 line',
      spot    : { file: '.mise/tasks/plugin/lines.toml', line: 2 }
    }])
  })

  test('lands on the file task declaring it', async ({ scratch }) => {
    await plant(scratch, { '.mise/tasks/plugin/old': FRONTMATTER + 'vitest run\n' })

    const audit = new Audit(scratch, mise(listing(scratch, [
      { file: true, name: 'plugin:old', source: '.mise/tasks/plugin/old', tools: { node: '20.19.0' } }
    ])))

    expect(TaskList.read(audit).findings(engines))
      .toMatchObject([{ spot: { file: '.mise/tasks/plugin/old', line: 1 }, title: 'Node floor' }])
  })
})

test('finds the tasks repo:verify runs and the tools each task declares', async ({ scratch }) => {
  await plant(scratch, { '.mise/tasks/repo/verify.toml': '["repo:verify"]\n' })

  const audit = new Audit(scratch, mise(listing(scratch, [{
    name   : 'repo:verify',
    run    : ['mise doctor project', { tasks: ['plugin:cover', 'repo:audit'] }],
    source : '.mise/tasks/repo/verify.toml',
    tools  : { jq: '1.8.2' }
  }])))

  const tasks = TaskList.read(audit)

  expect([tasks.verified, tasks.tools('repo:verify'), tasks.tools('plugin:cover')])
    .toEqual([new Set(['plugin:cover', 'repo:audit']), { jq: '1.8.2' }, undefined])
})
