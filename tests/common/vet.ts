import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { join }                         from 'node:path'

import getPort from 'get-port'

import { Homebridge }             from '../../.mise/vet/homebridge.ts'
import type { Stage }             from '../../.mise/vet/scenario.ts'
import { HELD }                   from '../../.mise/vet/vet.ts'
import schema                     from '../../config.schema.json' with { type: 'json' }
import config                     from '../homebridge/config.json' with { type: 'json' }
import { plant, test as scratch } from './scratch.js'

/**
 * How the stand-in Homebridge acts, each act off where unset.
 */
export interface Acts {
  accessories?   : unknown[]
  conflicts?     : boolean
  conflictsLate? : boolean
  exits?         : boolean
  fetches?       : string
  initializes?   : boolean
  lingers?       : boolean
  logs?          : string
  mute?          : boolean
  silent?        : boolean
  writes?        : string
}

/**
 * Stands in for the modules of the built plugin `Vet.read` imports, whose
 * parser fails every block, so a bridge is expected to expose no accessory.
 */
export const BUILT = {
  'dist/config/settings.js' : 'export class Settings { static parse() { return { ok: false } } }\n',
  'dist/sensor/outside.js'  : 'export const OUTSIDE = {}\n'
}
/**
 * The waits a case runs on, short enough to keep it quick and long enough for a
 * stand-in to start on a busy machine.
 */
export const TUNING = { grace: 3_000, observe: 4_000, settle: 100 }
const cache         = join(import.meta.dirname, '..', '..', '.cache')
const standIn       = join(import.meta.dirname, '..', 'mise', 'fixtures', 'homebridge.js')
/**
 * Extends the scratch fixture with `outside`, a directory under the checkout's
 * `.cache/` removed once the case ends, which lies outside the system temp
 * directory and `/tmp` wherever the checkout does.
 */
export const test = scratch.extend('outside', async ({ onTestFinished }) => {
  await mkdir(cache, { recursive: true })

  const outside = await mkdtemp(join(cache, 'vet-'))

  onTestFinished(() => rm(outside, { force: true, recursive: true }))

  return outside
})

/**
 * Plants under `root` what `Vet.read` reads there beside the releases, meaning
 * the schema, the run config, the built plugin's `package.json`, and the
 * modules `BUILT` stands in for.
 */
export async function checkout(root: string): Promise<void> {
  await plant(root, {
    ...BUILT,
    'config.schema.json'           : JSON.stringify(schema),
    'package.json'                 : '{}',
    'tests/homebridge/config.json' : JSON.stringify(config)
  })
}

/**
 * Installs the stand-in Homebridge into `dir` as the release `version`, as
 * `plugin:vet` installs a real one, and reads it back.
 */
export async function install(dir: string, version = '9.9.9'): Promise<Homebridge> {
  await plant(dir, {
    'node_modules/.bin/homebridge'         : await readFile(standIn, 'utf8'),
    'node_modules/homebridge/package.json' : JSON.stringify({ version })
  })

  return Homebridge.read(dir)
}

/**
 * Builds a stage under `scratch` on a port neither another case nor a local
 * Homebridge holds, whose storage directory holds the `acts.json` telling the
 * stand-in how to act.
 */
export async function stage(
  scratch : string,
  acts    : Acts        = {},
  signal  : AbortSignal = new AbortController().signal
): Promise<Stage> {
  const port    = await getPort({ exclude: HELD, reserve: true })
  const storage = join(scratch, 'storage')

  await plant(storage, { 'acts.json': JSON.stringify(acts) })

  return { port, signal, storage }
}
