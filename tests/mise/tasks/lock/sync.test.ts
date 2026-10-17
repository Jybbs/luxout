import { cp, readFile } from 'node:fs/promises'
import { join }         from 'node:path'

import { expect } from 'vitest'

import { plant, test } from '../../../common/scratch.js'
import { sync }        from '../../../common/sync.js'

const BAKE = [
  ['bun', 'install', '--lockfile-only'],
  ['bun', 'install', '--cwd', 'site', '--lockfile-only']
]
const LOCK    = [['mise', 'lock'], ['mise', 'ls', '--json', '--local', '--missing']]
const STANDIN = join(import.meta.dirname, '..', '..', 'fixtures', 'canned.sh')

/**
 * Runs the task in `scratch` under stand-ins for `mise` and `bun`, where
 * `mise ls` reports `missing` as the tools the project pins that mise has not
 * installed.
 *
 * Returns:
 *   Each call the stand-ins received, in order, beside the exit status.
 */
async function relock(
  missing : string[],
  scratch : string
): Promise<{ calls: string[][], status: number | null }> {
  const lacking = Object.fromEntries(missing.map((tool) => [tool, []]))

  await plant(scratch, { '.mise/mise.lock': '[[tools.bun]]\nversion = "1.4.2"\n', 'canned.log': '' })
  await Promise.all(['bun', 'mise'].map((program) => cp(STANDIN, join(scratch, 'bin', program))))

  const { status } = await sync(scratch, 'lock:sync', {
    env: {
      CANNED_LOG : join(scratch, 'canned.log'),
      TMPDIR     : scratch,
      CANNED     : JSON.stringify({
        'bun install --cwd site --lockfile-only' : {},
        'bun install --lockfile-only'            : {},
        [`mise install ${missing.join(' ')}`]    : {},
        'mise lock'                              : {},
        'mise ls --json --local --missing'       : { stdout: JSON.stringify(lacking) }
      })
    }
  })
  const log = await readFile(join(scratch, 'canned.log'), 'utf8')

  return { calls: log.split('\n').slice(0, -1).map((line) => JSON.parse(line).args), status }
}

test('locks mise first and installs each missing tool before either Bun package relocks', async ({
  scratch
}) => {
  expect(await relock(['bun', 'zizmor'], scratch)).toEqual({
    calls  : [...LOCK, ['mise', 'install', 'bun', 'zizmor'], ...BAKE],
    status : 0
  })
})

test('installs nothing where mise has installed every tool the project pins', async ({ scratch }) => {
  expect(await relock([], scratch)).toEqual({ calls: [...LOCK, ...BAKE], status: 0 })
})
