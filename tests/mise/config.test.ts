/** @module-tag spawns */
import { spawnSync } from 'node:child_process'
import { join }      from 'node:path'

import { expect, it } from 'vitest'

const root = join(import.meta.dirname, '..', '..')

it('runs the tools check under mise doctor project, read from .mise/config.toml', () => {
  // The report prints on either exit status, and the check fails on a runner missing a pinned tool
  const { stdout } = spawnSync('mise', ['doctor', 'project', '--json'], { cwd: root, encoding: 'utf8' })

  expect(JSON.parse(stdout)).toMatchObject({
    checks : [{ name: 'tools', source: join(root, '.mise', 'config.toml') }],
    errors : []
  })
})
