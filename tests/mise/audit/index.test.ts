import { spawnSync } from 'node:child_process'
import { chmod }     from 'node:fs/promises'
import { join }      from 'node:path'

import { expect } from 'vitest'

import { plant, test } from '../../common/scratch.ts'

const ENTRY = join(import.meta.dirname, '..', '..', '..', '.mise', 'audit', 'index.ts')

test('runs under Node’s type stripping and exits 1 on the annotations it prints', async ({ scratch }) => {
  await plant(scratch, {
    '.mise/config.toml'       : '[tools]\nnode = "24.21.0"\n',
    '.mise/tasks/plugin/bake' : '#!/usr/bin/env bash\nbun install\n',
    'package.json'            : JSON.stringify({ engines: { node: '^24.21.0 || ^26.10.0' } })
  })
  await chmod(join(scratch, '.mise', 'tasks', 'plugin', 'bake'), 0o755)

  const { status, stdout } = spawnSync(process.execPath, [ENTRY], {
    cwd      : scratch,
    encoding : 'utf8',
    env      : { ...process.env, MISE_TRUSTED_CONFIG_PATHS: scratch }
  })

  expect({ status, stdout }).toEqual({
    status : 1,
    stdout : '::error file=.mise/config.toml,line=2,title=Node pin::Node 24.21.0 sits outside '
           + '^26.10.0, the newest line `engines` admits\n'
           + '::error file=.mise/tasks/plugin/bake,line=2,title=Unfrozen install::`bun install` '
           + 'runs without `--frozen-lockfile` or `--lockfile-only`\n'
  })
}, 30_000)
