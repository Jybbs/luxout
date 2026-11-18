/** @module-tag spawns */
import { execFileSync } from 'node:child_process'
import { join }         from 'node:path'

import { expect, it } from 'vitest'

const root = join(import.meta.dirname, '..', '..')

it('runs the tools check under mise doctor project, read from .mise/config.toml', () => {
  const report = execFileSync('mise', ['doctor', 'project', '--json'], { cwd: root, encoding: 'utf8' })

  expect(JSON.parse(report)).toMatchObject({
    checks : [{ name: 'tools', source: join(root, '.mise', 'config.toml') }],
    errors : []
  })
})
