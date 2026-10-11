import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir }                                  from 'node:os'
import { dirname, join }                           from 'node:path'

import { test as base } from 'vitest'

export const test = base.extend('scratch', async ({ onTestFinished }) => {
  const scratch = await realpath(await mkdtemp(join(tmpdir(), 'luxout-')))

  onTestFinished(() => rm(scratch, { force: true, recursive: true }))

  return scratch
})

export async function plant(root: string, files: Record<string, string>): Promise<void> {
  await Promise.all(Object.entries(files).map(async ([file, text]) => {
    await mkdir(dirname(join(root, file)), { recursive: true })
    await writeFile(join(root, file), text)
  }))
}
