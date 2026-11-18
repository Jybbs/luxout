import { cp, mkdir, symlink } from 'node:fs/promises'
import { dirname, join }      from 'node:path'

import { branch, plant }     from './scratch.js'
import { type SyncRun, sync } from './sync.js'

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

export const ARGS  = ['--bail', '1']
export const BASE  = '5cb3ee2'
export const MERGE = ['git', 'merge-base', 'origin/main', 'HEAD']
const fixtures     = join(import.meta.dirname, '..', 'mise', 'fixtures')
const root         = join(import.meta.dirname, '..', '..')

/**
 * Runs `task` from `cwd`, which defaults to `repo`, under a stand-in `mise`
 * that runs each task file it names, once the branch at `repo` changes only
 * `changed`, or deletes it where `deleted` is set, since it left `origin/main`.
 *
 * The repository at `repo` holds the `planted` files and a copy of each
 * `copied` file, `tests/common/triggers.ts`, and `tests/coverage.json`, taken
 * from the repository the suite runs in at the same path. A link at each
 * `linked` path names its target, beside a link to the `node_modules` of the
 * repository the suite runs in.
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
    ...[...copied, 'tests/common/triggers.ts', 'tests/coverage.json']
      .map((file) => cp(join(root, file), join(repo, file))),
    cp(join(fixtures, 'mise.sh'), join(scratch, 'bin', 'mise')),
    ...Object.entries({ ...linked, node_modules: join(root, 'node_modules') }).map(async ([link, target]) => {
      await mkdir(dirname(join(repo, link)), { recursive: true })
      await symlink(target, join(repo, link))
    })
  ])

  await branch(changed, repo, deleted)

  const { status, stdout } = await sync(scratch, task, { cwd, env: { NO_COLOR: '1' } })

  return { ran: /Tests +1 passed/.test(stdout), status }
}

/**
 * Runs `task` in `scratch` with `ARGS`, beside stand-ins for `git` and `mise`,
 * where the merge base is `BASE`, the `suite` call that runs the tests passes,
 * and the call `failing` names exits 1.
 */
export function canned(scratch: string, suite: string[], task: string, failing?: string[]): Promise<SyncRun> {
  return sync(scratch, task, {
    args   : ARGS,
    canned : {
      [MERGE.join(' ')] : { stdout: `${BASE}\n` },
      [suite.join(' ')] : {},
      ...failing && { [failing.join(' ')]: { status: 1 } }
    }
  })
}
