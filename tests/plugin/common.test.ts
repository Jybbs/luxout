/** @module-tag spawns */
import { chmod } from 'node:fs/promises'
import { join }  from 'node:path'

import { vi } from 'vitest'

import { plant, test } from './common/scratch.js'

const LUXOUT = 'Luxout <luxout@example.com>'

test.concurrent(
  'builds each repository on main under one identity, reading no global or system config',
  async ({ expect, scratch }) => {
    const hooks  = join(scratch, 'template', 'hooks')
    const config = '[commit]\n\tgpgsign = true\n'
                 + `[core]\n\thooksPath = ${hooks}\n`
                 + `[init]\n\tdefaultBranch = trunk\n\ttemplateDir = ${join(scratch, 'template')}\n`
                 + '[user]\n\temail = planted@example.com\n\tname = Planted\n'

    await plant(scratch, {
      'home/.gitconfig'           : config,
      'repo/a.txt'                : 'a\n',
      'repo/b/c.txt'              : 'c\n',
      'template/hooks/pre-commit' : '#!/bin/sh\nexit 1\n',
      'xdg/git/config'            : config
    })
    await chmod(join(hooks, 'pre-commit'), 0o755)
    vi.stubEnv('GIT_CONFIG_SYSTEM', join(scratch, 'home', '.gitconfig'))
    vi.stubEnv('HOME', join(scratch, 'home'))
    vi.stubEnv('XDG_CONFIG_HOME', join(scratch, 'xdg'))
    vi.resetModules()

    const { start } = await import('./common/repository.js')
    const git       = start(join(scratch, 'repo'))

    expect({
      files  : git('ls-tree', '-r', '--name-only', 'HEAD'),
      global : git('var', 'GIT_CONFIG_GLOBAL'),
      log    : git('log', '--format=%D, %an <%ae>, %cn <%ce>')
    }).toEqual({
      files  : 'a.txt\nb/c.txt\n',
      global : '/dev/null\n',
      log    : `HEAD -> main, ${LUXOUT}, ${LUXOUT}\n`
    })
    expect(() => git('var', 'GIT_CONFIG_SYSTEM')).toThrow(expect.objectContaining({ status: 1 }))
  }
)
