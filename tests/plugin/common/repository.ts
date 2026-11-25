import { execFileSync }   from 'node:child_process'
import { appendFile, rm } from 'node:fs/promises'
import { join }           from 'node:path'

const environment = {
  GIT_AUTHOR_EMAIL    : 'luxout@example.com',
  GIT_AUTHOR_NAME     : 'Luxout',
  GIT_COMMITTER_EMAIL : 'luxout@example.com',
  GIT_COMMITTER_NAME  : 'Luxout',
  GIT_CONFIG_GLOBAL   : '/dev/null',
  GIT_CONFIG_NOSYSTEM : '1',
  PATH                : process.env.PATH
}

/**
 * Commits every file under `repo` to a new repository there, records that
 * commit as `origin/main`, then commits a newline appended to `changed`, or
 * its deletion where `deleted` is set, so the branch changes that file alone.
 */
export async function branch(changed: string, repo: string, deleted = false): Promise<void> {
  const git = start(repo)

  git('update-ref', 'refs/remotes/origin/main', 'HEAD')
  await (deleted ? rm(join(repo, changed)) : appendFile(join(repo, changed), '\n'))
  git('commit', '--all', '--message', 'Change', '--quiet')
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

/**
 * Starts a Git repository in `root` through `repository`, commits every file
 * under it, and returns the runner.
 */
export function start(root: string): ReturnType<typeof repository> {
  const git = repository(root)

  git('add', '--all')
  git('commit', '--message', 'Start', '--quiet')

  return git
}
