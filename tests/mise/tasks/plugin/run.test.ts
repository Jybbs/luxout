import { readFile, readdir, readlink } from 'node:fs/promises'
import { basename, join }              from 'node:path'

import { expect } from 'vitest'

import { plant, test } from '../../../common/scratch.js'
import { sync }        from '../../../common/sync.js'

interface Run {
  calls  : string[][]
  status : number | null
}

interface Setup {
  args?    : string[]
  failing? : boolean
  planted? : Record<string, string>
}

const CACHE = '.cache/homebridge'
const SEED  = {
  'tests/homebridge/bun.lock'     : 'lockfile\n',
  'tests/homebridge/bunfig.toml'  : 'bunfig\n',
  'tests/homebridge/config.json'  : 'config\n',
  'tests/homebridge/package.json' : 'manifest\n',
  'tests/homebridge/startup.json' : 'startup\n'
}
const config  = `${CACHE}/storage/config.json`
const startup = `${CACHE}/storage/.uix-hb-service-homebridge-startup.json`

test.for<{ planted: Record<string, string>, what: string }>([
  { planted: {},                                             what: 'neither' },
  { planted: { [config]: 'paired\n' },                       what: 'a config' },
  { planted: { [startup]: 'edited\n' },                      what: 'startup options' },
  { planted: { [config]: 'paired\n', [startup]: 'edited\n' }, what: 'both' }
])('copies only the seed files missing from storage that holds $what', async ({ planted }, { scratch }) => {
  await run(scratch, { planted })

  expect(await read(scratch, config, startup)).toEqual([
    planted[config] ?? SEED['tests/homebridge/config.json'],
    planted[startup] ?? SEED['tests/homebridge/startup.json']
  ])
})

test('installs the UI, then runs hb-service with the links, the storage, and every further argument', async ({
  scratch
}) => {
  const cache   = join(scratch, CACHE)
  const plugins = join(cache, 'plugins')
  const storage = join(cache, 'storage')

  expect(await run(scratch, { args: ['-T', 'holds a space'] })).toEqual({
    status : 0,
    calls  : [
      ['bun', 'install', '--cwd', cache, '--frozen-lockfile'],
      [
        'hb-service', 'run', '--plugin-path', plugins, '--stdout', '--strict-plugin-resolution',
        '--user-storage-path', storage, '-T', 'holds a space'
      ]
    ]
  })
})

test('installs from fresh copies of the manifest, the bunfig, and the lockfile on every run', async ({
  scratch
}) => {
  await run(scratch, { planted: { [`${CACHE}/bun.lock`]: 'stale\n' } })

  expect(await read(join(scratch, CACHE), 'bun.lock', 'bunfig.toml', 'package.json'))
    .toEqual(['lockfile\n', 'bunfig\n', 'manifest\n'])
})

test('links the checkout, its Homebridge, and the installed UI as the only plugins', async ({ scratch }) => {
  const plugins = join(scratch, CACHE, 'plugins')

  await run(scratch)

  const links = await Promise.all((await readdir(plugins)).map(async (name) => {
    return [name, await readlink(join(plugins, name))] as const
  }))

  expect(Object.fromEntries(links)).toEqual({
    'homebridge'             : join(scratch, 'node_modules', 'homebridge'),
    'homebridge-config-ui-x' : join('..', 'node_modules', 'homebridge-config-ui-x'),
    'homebridge-luxout'      : scratch
  })
})

test('replaces each link on a later run rather than writing a link inside the checkout', async ({
  scratch
}) => {
  await run(scratch)
  await run(scratch)

  expect({
    checkout : await readdir(scratch),
    luxout   : await readlink(join(scratch, CACHE, 'plugins', 'homebridge-luxout'))
  }).toEqual({ checkout: expect.not.arrayContaining([basename(scratch)]), luxout: scratch })
})

test('passes a checkout path holding a space whole to bun, hb-service, and the plugin link', async ({
  scratch
}) => {
  const checkout = join(scratch, 'holds a space')
  const cache    = join(checkout, CACHE)
  const plugins  = join(cache, 'plugins')
  const result   = await run(checkout)
  const luxout   = await readlink(join(plugins, 'homebridge-luxout'))

  expect({ luxout, result }).toEqual({
    luxout : checkout,
    result : {
      status : 0,
      calls  : [
        ['bun', 'install', '--cwd', cache, '--frozen-lockfile'],
        [
          'hb-service', 'run', '--plugin-path', plugins, '--stdout', '--strict-plugin-resolution',
          '--user-storage-path', join(cache, 'storage')
        ]
      ]
    }
  })
})

test('starts no Homebridge where the UI fails to install', async ({ scratch }) => {
  const { calls, status } = await run(scratch, { failing: true })

  expect({ programs: calls.map(([program]) => program), status }).toEqual({ programs: ['bun'], status: 1 })
})

async function read(directory: string, ...files: string[]): Promise<string[]> {
  return Promise.all(files.map((file) => readFile(join(directory, file), 'utf8')))
}

/**
 * Runs the task with `args` in `scratch`, a checkout holding the seed under
 * `tests/homebridge` beside the files `planted` adds, under stand-ins for `bun`
 * and `hb-service`, where `bun` fails instead where `failing` is set.
 *
 * Returns:
 *   Each program the task ran with its arguments, in order, beside the exit
 *   status.
 */
async function run(scratch: string, { args = [], failing = false, planted = {} }: Setup = {}): Promise<Run> {
  const cache = join(scratch, CACHE)
  const start = [
    'hb-service', 'run', '--plugin-path', join(cache, 'plugins'), '--stdout', '--strict-plugin-resolution',
    '--user-storage-path', join(cache, 'storage'), ...args
  ]

  await plant(scratch, { ...SEED, ...planted })

  const { invoked, status } = await sync(scratch, 'plugin:run', {
    args   : args,
    canned : {
      [`bun install --cwd ${cache} --frozen-lockfile`] : failing ? { status: 1 } : {},
      [start.join(' ')]                                : {}
    }
  })

  return { calls: invoked.map((call) => call.args), status }
}
