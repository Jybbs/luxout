/** @module-tag spawns */
import { readdir } from 'node:fs/promises'

import { describe } from 'vitest'

import { plant, test } from '../../../common/scratch.js'
import { sync }        from '../../../common/sync.js'

const SCRIPTS = ['install', 'postinstall', 'preinstall', 'prepare', 'preprepare', 'postprepare']

describe.concurrent('plugin:bake', () => {
  test('runs none of the lifecycle scripts the manifest declares, whatever the environment sets', async ({
    expect,
    scratch
  }) => {
    const scripts = Object.fromEntries(SCRIPTS.map((script) => [script, `touch ran-${script}`]))

    await plant(scratch, { 'package.json': JSON.stringify({ name: 'fixture', scripts, version: '1.0.0' }) })

    const { status } = await sync(scratch, 'plugin:bake', { env: { NPM_CONFIG_IGNORE_SCRIPTS: 'false' } })

    expect({ ran: (await readdir(scratch)).filter((file) => file.startsWith('ran-')), status })
      .toEqual({ ran: [], status: 0 })
  })
})
