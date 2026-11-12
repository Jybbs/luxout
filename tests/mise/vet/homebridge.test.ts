/** @module-tag spawns */
import { readFile, writeFile } from 'node:fs/promises'
import { join }                from 'node:path'

import type { Block, Launch, Run }                 from '../../../.mise/vet/homebridge.ts'
import { type Acts, TUNING, install, stage, test } from '../../common/vet.js'

type Flags = Pick<Launch, 'insecure' | 'offline'>

const BLOCK = { name: 'Outside', platform: 'Luxout' }

/**
 * Starts the stand-in Homebridge installed under `scratch` under `block`,
 * acting as `acts` asks, with the launch's `flags` set.
 */
async function start(scratch: string, acts?: Acts, block?: Block, flags: Flags = {}) {
  const homebridge = await install(join(scratch, 'release'), '2.4.0')
  const launch     = await stage(scratch, acts)

  return { launch, run: await homebridge.start({ ...launch, ...flags, block }) }
}

/**
 * Starts the stand-in as `start` does under the block, and stops it once it
 * listens.
 */
async function stopped(scratch: string, acts?: Acts, flags?: Flags): Promise<Run> {
  const { run } = await start(scratch, acts, BLOCK, flags)

  await run.started(TUNING.observe)
  await run.stop(TUNING.grace)

  return run
}

test.concurrent('reads the release from the package under its directory', async ({ expect, scratch }) => {
  const homebridge = await install(join(scratch, 'release'), '1.8.5')

  expect({ dir: homebridge.dir, version: homebridge.version }).toEqual({
    dir     : join(scratch, 'release'),
    version : '1.8.5'
  })
})

test.concurrent('writes a config holding the bridge and the block before it starts', async ({
  expect,
  scratch
}) => {
  const { launch, run } = await start(scratch, {}, BLOCK)
  const config          = JSON.parse(await readFile(join(launch.storage, 'config.json'), 'utf8'))
  const bytes           = launch.port.toString(16).toUpperCase().padStart(4, '0')
  const username        = `CC:22:3D:E3:${bytes.slice(0, 2)}:${bytes.slice(2)}`

  await run.stop(TUNING.grace)

  expect(config).toEqual({
    accessories : [],
    bridge      : { name: 'Test Bridge', pin: '031-45-154', port: launch.port, username },
    platforms   : [BLOCK]
  })
})

test.concurrent('lists no platform where it starts with no block', async ({ expect, scratch }) => {
  const { launch, run } = await start(scratch)

  await run.stop(TUNING.grace)

  expect(JSON.parse(await readFile(join(launch.storage, 'config.json'), 'utf8')).platforms).toEqual([])
})

test.concurrent('starts on the storage, loading only the plugins installed beside the release', async ({
  expect,
  scratch
}) => {
  const { launch, run } = await start(scratch, {}, BLOCK)
  const started         = await run.started(TUNING.observe)
  const plugins         = join(scratch, 'release', 'node_modules')

  await run.stop(TUNING.grace)

  expect({ output: run.output, started }).toEqual({
    output  : expect.stringContaining(
      `Started with -P ${plugins} -Q -U ${launch.storage} --strict-plugin-resolution\n`
    ),
    started : true
  })
})

test.concurrent('starts insecure where the launch asks', async ({ expect, scratch }) => {
  const run = await stopped(scratch, {}, { insecure: true })

  expect(run.output).toEqual(expect.stringContaining('--strict-plugin-resolution -I\n'))
})

test.concurrent('reports an exit within the grace after SIGTERM', async ({ expect, scratch }) => {
  const { run } = await start(scratch, {}, BLOCK)

  await run.started(TUNING.observe)

  await run.stop(TUNING.grace)

  expect({ exited: run.exited, faults: run.faults }).toEqual({ exited: true, faults: [] })
})

test.concurrent('reports no start where it never listens before the timeout', async ({ expect, scratch }) => {
  const { run } = await start(scratch, { mute: true }, BLOCK)

  expect(await run.started(200)).toBe(false)

  await run.stop(TUNING.grace)
})

test.concurrent('reports no start and a conflict where it exits on a port in use', async ({
  expect,
  scratch
}) => {
  await writeFile(join((await stage(scratch)).storage, 'started'), '')

  const { run } = await start(scratch, { conflicts: true }, BLOCK)
  const started = await run.started(TUNING.observe)

  expect({ conflicted: run.conflicted, started }).toEqual({ conflicted: true, started: false })
})

test.concurrent('kills a run that outlasts the grace after SIGTERM', async ({ expect, scratch }) => {
  const { run } = await start(scratch, { lingers: true }, BLOCK)

  await run.started(TUNING.observe)

  await run.stop(200)

  expect({ exited: run.exited, faults: run.faults }).toEqual({
    exited : true,
    faults : ['takes longer than 0.2 seconds to exit after SIGTERM']
  })
})

test.concurrent('kills the run once its signal aborts', async ({ expect, scratch }) => {
  const controller = new AbortController()
  const homebridge = await install(join(scratch, 'release'))
  const launch     = await stage(scratch, { lingers: true }, controller.signal)
  const run        = await homebridge.start({ ...launch, block: BLOCK })

  await run.started(TUNING.observe)
  controller.abort()
  await run.wait(TUNING.grace)

  expect(run.exited).toBe(true)
})

test.concurrent('names each error the replay fails a run on that the output carries', async ({
  expect,
  scratch
}) => {
  const logs = 'TypeError: x is not a function\nCannot find module y'

  expect((await stopped(scratch, { logs })).errors).toEqual(['TypeError', 'Cannot find module'])
})

test.concurrent('reads the platform as initialized where the output says so', async ({ expect, scratch }) => {
  const run = await stopped(scratch)

  expect({ luxout: run.initialized('Luxout'), other: run.initialized('Other') }).toEqual({
    luxout : true,
    other  : false
  })
})

test.concurrent('names a path written outside the storage, and none written inside it', async ({
  expect,
  outside,
  scratch
}) => {
  const file = join(outside, 'outside.json')

  expect((await stopped(scratch, { writes: file })).writes).toEqual([file])
})

test.concurrent.for([
  { offline: false, preloads: ['writes.ts'] },
  { offline: true, preloads: ['writes.ts', 'offline.ts'] }
])('loads the preloads $preloads where offline is $offline', async ({ offline, preloads }, {
  expect,
  scratch
}) => {
  const run  = await stopped(scratch, {}, { offline })
  const line = run.output.split('\n').find((line) => line.startsWith('Preloaded with')) ?? ''

  expect(line.match(/\w+\.ts/g)).toEqual(preloads)
})

test.concurrent('fails a request as ENOTFOUND where the run starts offline', async ({ expect, scratch }) => {
  const run = await stopped(scratch, { fetches: 'https://api.open-meteo.com/v1/forecast' }, { offline: true })

  expect(run.output).toEqual(expect.stringContaining('Fetch failed: ENOTFOUND\n'))
})
