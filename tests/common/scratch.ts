import { execFileSync }                                        from 'node:child_process'
import { appendFile, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir }                                              from 'node:os'
import { dirname, join }                                       from 'node:path'

import { test as base } from 'vitest'

const environment = {
  GIT_AUTHOR_EMAIL    : 'luxout@example.com',
  GIT_AUTHOR_NAME     : 'Luxout',
  GIT_COMMITTER_EMAIL : 'luxout@example.com',
  GIT_COMMITTER_NAME  : 'Luxout',
  GIT_CONFIG_GLOBAL   : '/dev/null',
  GIT_CONFIG_NOSYSTEM : '1',
  PATH                : process.env.PATH
}

export const test = base.extend('scratch', async ({ onTestFinished }) => {
  const scratch = await realpath(await mkdtemp(join(tmpdir(), 'luxout-')))

  onTestFinished(() => rm(scratch, { force: true, recursive: true }))

  return scratch
})

/**
 * Commits every file under `repo` to a new repository there, records that
 * commit as `origin/main`, then commits a newline appended to `changed`, or
 * its deletion where `deleted` is set, so the branch changes that file alone.
 */
export async function branch(changed: string, repo: string, deleted = false): Promise<void> {
  const git = repository(repo)

  git('add', '--all')
  git('commit', '--message', 'Start', '--quiet')
  git('update-ref', 'refs/remotes/origin/main', 'HEAD')
  await (deleted ? rm(join(repo, changed)) : appendFile(join(repo, changed), '\n'))
  git('commit', '--all', '--message', 'Change', '--quiet')
}

export async function plant(root: string, files: Record<string, string>): Promise<void> {
  await Promise.all(Object.entries(files).map(async ([file, text]) => {
    await mkdir(dirname(join(root, file)), { recursive: true })
    await writeFile(join(root, file), text)
  }))
}

/**
 * Starts a Git repository on `main` in `root` and returns a runner for Git
 * commands there, which runs each under one fixed identity with no global or
 * system config and returns what it prints.
 */
export function repository(root: string): (...args: string[]) => string {
  const git = (...args: string[]): string => execFileSync('git', args, {
    cwd      : root,
    encoding : 'utf8',
    env      : environment
  })

  git('init', '--initial-branch', 'main', '--quiet')

  return git
}
