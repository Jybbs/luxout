/** @module-tag spawns */
import { spawnSync } from 'node:child_process'
import { chmod }     from 'node:fs/promises'
import { join }      from 'node:path'

import { expect } from 'vitest'

import { root }        from '../../common/paths.js'
import { repository }  from '../../common/repository.js'
import { plant, test } from '../../common/scratch.js'

const entry = join(root, '.mise', 'audit', 'index.ts')

test('runs under Node’s type stripping and exits 1 on the annotations it prints', async ({ scratch }) => {
  await plant(scratch, {
    '.mise/config.toml'             : '[tools]\nnode = "24.21.0"\n',
    '.mise/lib/lock.sh'             : 'bun_packages() {\n  printf "%s\\n" . extra tests/plugin/vet/*\n}\n',
    '.mise/tasks/plugin/bake'       : '#!/usr/bin/env bash\nbun install\n',
    'extra/package.json'            : '{\n  "dependencies": { "a": "^1.0.0" }\n}\n',
    'package.json'                  : JSON.stringify({ engines: { node: '^24.21.0 || ^26.10.0' } }),
    'src/long.ts'                   : `${'a'.repeat(111)}\n`,
    'tests/plugin/vet/floor/package.json'  : '{}',
    'tests/plugin/vet/pinned/package.json' : '{}'
  })
  await chmod(join(scratch, '.mise', 'tasks', 'plugin', 'bake'), 0o755)
  repository(scratch)('add', 'src/long.ts')

  const { status, stdout } = spawnSync(process.execPath, [entry], {
    cwd      : scratch,
    encoding : 'utf8',
    env      : { ...process.env, MISE_TRUSTED_CONFIG_PATHS: scratch }
  })

  expect({ status, stdout }).toEqual({
    status : 1,
    stdout : '::error file=extra/package.json,line=2,title=Exact pin::`a` pins "^1.0.0" under '
           + '`dependencies`, which names no exact release\n'
           + '::error file=.mise/config.toml,line=2,title=Node pin::Node 24.21.0 sits outside '
           + '^26.10.0, the newest line `engines` admits\n'
           + '::error file=.mise/tasks/plugin/bake,line=2,title=Unfrozen install::`bun install` '
           + 'runs without `--frozen-lockfile` or `--lockfile-only`\n'
           + '::error file=src/long.ts,line=1,title=Line length::The line runs 111 characters, '
           + 'past the 110-character budget\n'
  })
})
