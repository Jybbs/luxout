import { execFileSync }    from 'node:child_process'
import { cp, readFile }    from 'node:fs/promises'
import { delimiter, join } from 'node:path'

import { plant } from './scratch.js'

const root = join(import.meta.dirname, '..', '..')
const path = execFileSync('mise', ['x', '--', 'printenv', 'PATH'], { cwd: root, encoding: 'utf8' }).trim()

/**
 * Reads back the arguments of each call the stand-in `gh` logged in `scratch`.
 */
export async function logged(scratch: string): Promise<string[][]> {
  const log = await readFile(join(scratch, 'gh.log'), 'utf8')

  return log.split('\n').slice(0, -1).map((call) => call.split('\0').slice(0, -1))
}

/**
 * Puts the stand-in `gh` in `scratch`, returning the `GH_LOG` it writes each
 * call to and a `PATH` that puts it ahead of the tools mise pins.
 */
export async function standIn(scratch: string): Promise<{ GH_LOG: string, PATH: string }> {
  await plant(scratch, { 'gh.log': '' })
  await cp(join(import.meta.dirname, '..', 'mise', 'fixtures', 'gh.sh'), join(scratch, 'bin', 'gh'))

  return { GH_LOG: join(scratch, 'gh.log'), PATH: join(scratch, 'bin') + delimiter + path }
}
