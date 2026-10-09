import { join } from 'node:path'

import { describe, expect } from 'vitest'

import { Actions }     from '../../../.mise/audit/actions.ts'
import { Audit }       from '../../../.mise/audit/audit.ts'
import { TaskList }    from '../../../.mise/audit/tasks.ts'
import { Workflows }   from '../../../.mise/audit/workflows.ts'
import { mise }        from '../../common/mise.js'
import { plant, test } from '../../common/scratch.js'

const COMMIT    = '3d3c42e5aac5ba805825da76410c181273ba90b1'
const FILE      = '.github/workflows/ci.yml'
const OTHER     = '2d8d4cafcbd33be2ea37d2b6f5ad595363d1f1ca'
const PROVISION = 'inputs:\n  tools:\n    required: true\nruns:\n  using: composite\n'
const TASKS     = '["repo:verify"]\n\n["plugin:cover"]\n\n["plugin:lint"]\n\n["plugin:test:22"]\n'
const CI        = [
  'name: 🔆 CI',
  'on:',
  '  pull_request:',
  '  workflow_dispatch:',
  'concurrency:',
  "  cancel-in-progress: ${{ github.event_name == 'pull_request' }}",
  '  group: ${{ github.workflow }}-${{ github.ref }}',
  'jobs:',
  '  check:',
  '    runs-on: ubuntu-26.04',
  '    timeout-minutes: 15',
  '    strategy:',
  '      matrix:',
  '        include:',
  '          - task: plugin:cover',
  '            tools: bun node',
  '          - task: plugin:test:22',
  '            tools: bun node@22.23.3',
  '    steps:',
  `      - uses: actions/checkout@${COMMIT}`,
  '      - uses: $/.github/actions/provision',
  '        with:',
  '          tools: ${{ matrix.tools }}',
  '      - run: mise run "$TASK"',
  '  brief:',
  '    name: 🪁 Brief',
  '    if: always()',
  '    needs: [check]',
  '    runs-on: ubuntu-26.04',
  '    timeout-minutes: 5',
  '    steps:',
  '      - run: mise run gha:brief >> "$GITHUB_STEP_SUMMARY"'
].join('\n')

const audit = async (scratch: string, text: string, actions = new Actions({})) =>
  new Workflows({ [FILE]: text }).findings(actions, await tasks(scratch))

async function tasks(scratch: string): Promise<TaskList> {
  const source = join(scratch, '.mise/tasks/plugin.toml')

  const listed = [
    { name: 'repo:verify', run: [{ tasks: ['plugin:cover'] }], tools: {} },
    { name: 'plugin:cover', run: ['vitest'], tools: {} },
    { name: 'plugin:lint', run: ['oxlint'], tools: {} },
    { name: 'plugin:test:22', run: ['vitest'], tools: { node: '22.23.3' } }
  ].map((task) => ({ ...task, file: null, source }))

  await plant(scratch, { '.mise/tasks/plugin.toml': TASKS })

  return TaskList.read(new Audit(scratch, mise(listed)))
}

test('reports nothing on a workflow meeting every check', async ({ scratch }) => {
  expect(await audit(scratch, CI)).toEqual([])
})

describe('a workflow on its own', () => {
  test.for([
    {
      line  : 3,
      name  : 'a `schedule` trigger in a mapping',
      text  : CI.replace('on:\n', "on:\n  schedule:\n    - cron: '0 0 * * *'\n"),
      title : 'Schedule trigger'
    },
    {
      line  : 2,
      name  : 'a `schedule` trigger in a list',
      text  : CI.replace('on:\n  pull_request:\n  workflow_dispatch:', 'on: [pull_request, schedule]'),
      title : 'Schedule trigger'
    },
    {
      line  : 2,
      name  : 'a `schedule` trigger written as a bare string',
      text  : CI.replace('on:\n  pull_request:\n  workflow_dispatch:', 'on: schedule'),
      title : 'Schedule trigger'
    },
    {
      line  : 3,
      name  : 'a workflow `pull_request` triggers with no `concurrency` key',
      text  : CI.replace(/concurrency:\n.*\n.*\n/, ''),
      title : 'Concurrency'
    },
    {
      line  : 6,
      name  : 'a workflow `pull_request` triggers whose `cancel-in-progress` is `false`',
      text  : CI.replace("${{ github.event_name == 'pull_request' }}", 'false'),
      title : 'Concurrency'
    },
    {
      line  : 6,
      name  : 'a workflow `pull_request` triggers whose group leaves `cancel-in-progress` unset',
      text  : CI.replace(/ {2}cancel-in-progress.*\n/, ''),
      title : 'Concurrency'
    },
    {
      line  : 5,
      name  : 'a workflow `pull_request` triggers whose group is a bare string',
      text  : CI.replace(/concurrency:\n.*\n.*\n/, 'concurrency: ${{ github.workflow }}-${{ github.ref }}\n'),
      title : 'Concurrency'
    },
    {
      line  : 7,
      name  : 'a group that reads no `github.ref`',
      text  : CI.replace('-${{ github.ref }}', ''),
      title : 'Concurrency'
    },
    {
      line  : 7,
      name  : 'a group keyed on `github.head_ref` rather than `github.ref`',
      text  : CI.replace('${{ github.ref }}', '${{ github.head_ref }}'),
      title : 'Concurrency'
    },
    {
      line  : 6,
      name  : '`cancel-in-progress` on every run',
      text  : CI.replace("${{ github.event_name == 'pull_request' }}", 'true'),
      title : 'Concurrency'
    },
    {
      line  : 9,
      name  : 'a job with no `timeout-minutes`',
      text  : CI.replace('    timeout-minutes: 15\n', ''),
      title : 'Job timeout'
    },
    {
      line  : 1,
      name  : 'no `jobs` at all',
      text  : CI.slice(0, CI.indexOf('jobs:')),
      title : 'Brief gate'
    },
    {
      line  : 9,
      name  : 'no `🪁 Brief` gate',
      text  : CI.replace('🪁 Brief', 'Brief'),
      title : 'Brief gate'
    },
    {
      line  : 27,
      name  : 'a gate that runs only while every job passes',
      text  : CI.replace('if: always()', 'if: success()'),
      title : 'Brief gate'
    },
    {
      line  : 25,
      name  : 'a gate with no condition',
      text  : CI.replace('    if: always()\n', ''),
      title : 'Brief gate'
    },
    {
      line  : 28,
      name  : 'a gate that waits on no `check`',
      text  : CI.replace('needs: [check]', 'needs: []'),
      title : 'Brief gate'
    },
    {
      line  : 25,
      name  : 'a gate with no `needs`',
      text  : CI.replace('    needs: [check]\n', ''),
      title : 'Brief gate'
    },
    {
      line  : 24,
      name  : 'a job other than the gate writing the step summary',
      text  : CI.replace('mise run "$TASK"', 'mise run "$TASK" >> "$GITHUB_STEP_SUMMARY"'),
      title : 'Step summary'
    }
  ])('reports $name', async ({ line, text, title }, { scratch }) => {
    expect(await audit(scratch, text)).toMatchObject([{ spot: { file: FILE, line }, title }])
  })

  test.for([
    {
      name : 'a workflow `pull_request` does not trigger, with no `concurrency` key',
      text : CI.replace('  pull_request:\n', '').replace(/concurrency:\n.*\n.*\n/, '')
    },
    {
      name : 'a workflow `pull_request` does not trigger, whose `cancel-in-progress` is `false`',
      text : CI
        .replace('  pull_request:\n', '')
        .replace("${{ github.event_name == 'pull_request' }}", 'false')
    },
    {
      name : 'a gate under `${{ always() }}`',
      text : CI.replace('if: always()', 'if: ${{ always() }}')
    },
    {
      name : 'a gate whose `needs` names one job as a string',
      text : CI.replace('needs: [check]', 'needs: check')
    },
    {
      name : 'a job calling a reusable workflow, which takes no `timeout-minutes`',
      text : CI
        .replace('  brief:', `  call:\n    uses: o/r/.github/workflows/x.yml@${COMMIT}\n  brief:`)
        .replace('[check]', '[call, check]')
    },
    {
      name : 'a matrix row naming no task',
      text : CI.replace('- task: plugin:cover\n            tools: bun node', '- os: linux')
    }
  ])('passes $name', async ({ text }, { scratch }) => {
    expect(await audit(scratch, text)).toEqual([])
  })

  test('reports a workflow that fails to parse rather than throwing', async ({ scratch }) => {
    expect(await audit(scratch, `${CI}\n  - [`))
      .toContainEqual(expect.objectContaining({ title: 'Parse error' }))
  })
})

describe('the workflows together', () => {
  test.for([
    {
      line    : 10,
      message : '`ubuntu-latest` names no versioned runner image',
      name    : 'a `-latest` alias',
      text    : CI.replace('runs-on: ubuntu-26.04', 'runs-on: ubuntu-latest')
    },
    {
      line    : 29,
      message : `\`ubuntu-24.04\` differs from \`ubuntu-26.04\`, the image ${FILE}:10 names`,
      name    : 'two images',
      text    : CI.replace(/(brief:[\s\S]*)ubuntu-26.04/, '$1ubuntu-24.04')
    },
    {
      line    : 33,
      message : `\`actions/checkout\` pins ${OTHER}, whereas ${FILE}:20 pins ${COMMIT}`,
      name    : 'an action pinned to two commits',
      text    : CI.replace('mise run gha:brief', `x\n      - uses: actions/checkout@${OTHER}\n      - run: x`)
    },
    {
      line    : 23,
      message : '`$/.github/actions/provision` declares no input `tool`',
      name    : 'an input the composite action does not declare',
      text    : CI.replace('tools: ${{ matrix.tools }}', 'tool: ${{ matrix.tools }}')
    },
    {
      line    : 15,
      message : 'Row `plugin:lint` runs a task `repo:verify` leaves out, '
              + 'so `mise ci` passes where the row fails',
      name    : 'a row whose task repo:verify leaves out',
      text    : CI.replace('task: plugin:cover', 'task: plugin:lint')
    },
    {
      line    : 15,
      message : 'Row `plugin:pack` runs a task `repo:verify` leaves out, '
              + 'so `mise ci` passes where the row fails',
      name    : 'a row naming a task mise does not list',
      text    : CI.replace('task: plugin:cover', 'task: plugin:pack')
    },
    {
      line    : 17,
      message : 'Row `plugin:test:22` installs no `node@22.23.3`, the release its task runs on',
      name    : 'a row naming no tools',
      text    : CI.replace('            tools: bun node@22.23.3\n', '')
    }
  ])('reports $name', async ({ line, message, text }, { scratch }) => {
    const actions = new Actions({ '.github/actions/provision/action.yml': PROVISION })

    expect(await audit(scratch, text, actions)).toMatchObject([{ message, spot: { file: FILE, line } }])
  })

  test('reports a row naming a release its task does not run on', async ({ scratch }) => {
    expect(await audit(scratch, CI.replace('node@22.23.3', 'node@22.23.2'))).toMatchObject([
      { message: 'Row `plugin:test:22` installs no `node@22.23.3`, the release its task runs on' },
      { message: 'Row `plugin:test:22` installs `node@22.23.2`, a release its task does not declare' }
    ].map((finding) => ({ ...finding, spot: { line: 18 } })))
  })

  test('holds the pins in a composite action to those in every workflow', async ({ scratch }) => {
    const actions = new Actions({
      '.github/actions/a/action.yml': `runs:\n  steps:\n    - uses: actions/checkout@${OTHER}\n`
    })

    expect(await audit(scratch, CI, actions)).toMatchObject([{
      message : `\`actions/checkout\` pins ${OTHER}, whereas ${FILE}:20 pins ${COMMIT}`,
      spot    : { file: '.github/actions/a/action.yml', line: 3 }
    }])
  })
})

test('reads no row against a task list mise failed to print', ({ scratch }) => {
  const tasks = TaskList.read(new Audit(scratch, () => ({ stderr: 'mise ERROR', stdout: '' })))

  expect(new Workflows({ [FILE]: CI }).findings(new Actions({}), tasks)).toEqual([])
})

test('reads every workflow under .github/workflows/ from the checkout', async ({ scratch }) => {
  await plant(scratch, {
    '.github/a.yml'            : 'jobs:\n  c:\n    timeout-minutes: 1\n',
    '.github/workflows/a.yml'  : 'jobs:\n  a:\n    timeout-minutes: 1\n',
    '.github/workflows/b.yaml' : 'jobs:\n  b:\n    timeout-minutes: 1\n'
  })

  const findings = Workflows.read(new Audit(scratch)).findings(new Actions({}), await tasks(scratch))

  expect(new Set(findings.map(({ spot }) => spot.file)))
    .toEqual(new Set(['.github/workflows/a.yml', '.github/workflows/b.yaml']))
})
