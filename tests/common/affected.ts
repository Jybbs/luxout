import { cp, mkdir, symlink } from 'node:fs/promises'
import { dirname, join }      from 'node:path'

import { branch, plant } from './scratch.js'
import { sync }          from './sync.js'

/**
 * The repository an `affected` task runs from, under a stand-in `mise` in
 * `scratch`, beside the branch it carries.
 */
interface Checkout {
  changed  : string
  copied   : string[]
  linked   : Record<string, string>
  repo     : string
  scratch  : string
  task     : string
  cwd?     : string
  deleted? : boolean
}

const fixtures = join(import.meta.dirname, '..', 'mise', 'fixtures')
const root     = join(import.meta.dirname, '..', '..')

/**
 * Runs `task` from `cwd`, which defaults to `repo`, under a stand-in `mise`
 * that runs each task file it names, once the branch at `repo` changes only
 * `changed`, or deletes it where `deleted` is set, since it left `origin/main`.
 *
 * The repository at `repo` holds the `planted` files and a copy of each
 * `copied` file, `tests/common/coverage.ts`, and `tests/common/triggers.ts`,
 * taken from the repository the suite runs in at the same path. A link at each
 * `linked` path names its target, beside a link to the `node_modules` of the
 * repository the suite runs in. The task runs under the `COVERAGE_FLOOR` the
 * suite runs under.
 *
 * Returns:
 *   Whether Vitest reported one test passing, beside the task's exit status.
 */
export async function affected(
  { changed, copied, deleted, linked, repo, cwd = repo, scratch, task } : Checkout,
  planted                                                                : Record<string, string>
): Promise<{ ran: boolean, status: number | null }> {
  await plant(repo, planted)
  await Promise.all([
    ...[...copied, 'tests/common/coverage.ts', 'tests/common/triggers.ts']
      .map((file) => cp(join(root, file), join(repo, file))),
    cp(join(fixtures, 'mise.sh'), join(scratch, 'bin', 'mise')),
    ...Object.entries({ ...linked, node_modules: join(root, 'node_modules') }).map(async ([link, target]) => {
      await mkdir(dirname(join(repo, link)), { recursive: true })
      await symlink(target, join(repo, link))
    })
  ])

  await branch(changed, repo, deleted)

  const { status, stdout } = await sync(scratch, task, {
    cwd : cwd,
    env : { COVERAGE_FLOOR: process.env.COVERAGE_FLOOR, NO_COLOR: '1' }
  })

  return { ran: /Tests +1 passed/.test(stdout), status }
}

/**
 * Returns the source of a test that reads the file `expression` names.
 */
export function reader(expression: string): string {
  return "import { globSync, readFileSync } from 'node:fs'\nimport { join } from 'node:path'\n\n"
       + "import { expect, test } from 'vitest'\n\n"
       + `test('reads a file', () => {\n  expect(readFileSync(${expression}, 'utf8')).not.toBe('')\n})\n`
}
