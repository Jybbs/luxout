import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir }                                  from 'node:os'
import { dirname, join }                           from 'node:path'

import { test as base } from 'vitest'

/**
 * Extends `test` with `scratch`, a directory under the system's temporary
 * directory that each case owns, named by its real path and removed once the
 * case ends.
 */
export const test = base.extend('scratch', async ({ onTestFinished }) => {
  const scratch = await realpath(await mkdtemp(join(tmpdir(), 'luxout-')))

  onTestFinished(() => rm(scratch, { force: true, recursive: true }))

  return scratch
})

/**
 * Writes each of `files` under `root`, keyed by its path relative to `root`.
 */
export async function plant(root: string, files: Record<string, string>): Promise<void> {
  await Promise.all(Object.entries(files).map(async ([file, text]) => {
    await mkdir(dirname(join(root, file)), { recursive: true })
    await writeFile(join(root, file), text)
  }))
}
