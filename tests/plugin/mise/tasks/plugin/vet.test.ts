/** @module-tag spawns-many */
import { execFile }                          from 'node:child_process'
import { mkdir, readFile, readdir, symlink } from 'node:fs/promises'
import { join }                              from 'node:path'
import { promisify }                         from 'node:util'

import { describe } from 'vitest'

import { plant, test }   from '../../../common/scratch.js'
import { sync }          from '../../../common/sync.js'
import { BUILT, TUNING } from '../../../common/vet.js'

/**
 * A package the fixture checkout installs from a tarball of its own, exporting
 * `true` under each name `exports` lists from a module of the form `type`
 * names.
 */
interface Vendored {
  exports : string[]
  name    : string
  type    : 'commonjs' | 'module'
  version : string
}

/**
 * The source of a plugin that imports its one dependency and a value both
 * releases export, then writes into its storage.
 */
const CONTROL = "import { writeFileSync } from 'node:fs'\n"
              + "import { shared } from 'homebridge'\n"
              + "import { present } from 'present'\n"
              + "writeFileSync(process.env.HB_STORAGE_PATH + '/written', '')\n"
const NEVER    = 'fails, since it never initializes the Luxout platform'
const RELEASES = ['floor', 'pinned'] as const
/**
 * The packages the fixture checkout installs, where `floor` stands in for
 * Homebridge 1.8.5 as the CommonJS module that release is, and `pinned` for
 * 2.4.0, the one the checkout's devDependencies install.
 */
const VENDORED = {
  absent  : { exports: ['absent'], name: 'absent', type: 'module', version: '1.0.0' },
  floor   : { exports: ['shared'], name: 'homebridge', type: 'commonjs', version: '1.8.5' },
  pinned  : { exports: ['newer', 'shared'], name: 'homebridge', type: 'module', version: '2.4.0' },
  present : { exports: ['present'], name: 'present', type: 'module', version: '1.0.0' }
} satisfies Record<string, Vendored>
const exec     = promisify(execFile)
const fixtures = join(import.meta.dirname, '..', '..', 'fixtures')
const scripts  = { NPM_CONFIG_IGNORE_SCRIPTS: process.env.NPM_CONFIG_IGNORE_SCRIPTS }

/**
 * Builds a checkout under `scratch` whose packed plugin runs `source`, beside a
 * seed for each release and a `node_modules` holding every package its manifest
 * declares, the devDependencies `absent` and the 2.4.0 stand-in among them. The
 * manifest's failing `postinstall` fails any install that runs without the
 * `NPM_CONFIG_IGNORE_SCRIPTS` of `.mise/config.toml`.
 */
async function checkout(scratch: string, source: string): Promise<string> {
  const dir      = join(scratch, 'checkout')
  const env      = { ...scripts, BUN_INSTALL_CACHE_DIR: join(scratch, 'cache'), PATH: process.env.PATH }
  const standIn  = await readFile(join(fixtures, 'homebridge.js'), 'utf8')
  const tarball  = (key: string): string => join(scratch, 'vendor', `${key}.tgz`)
  const manifest = JSON.stringify({
    dependencies    : { present: tarball('present') },
    devDependencies : { absent: tarball('absent'), homebridge: tarball('pinned') },
    main            : 'index.js',
    name            : 'homebridge-luxout',
    scripts         : { postinstall: 'exit 1' },
    type            : 'module',
    version         : '1.2.3'
  })
  const seeds = RELEASES.map((release) => [
    `tests/plugin/vet/${release}/package.json`,
    JSON.stringify({ dependencies: { homebridge: tarball(release) } })
  ])

  await Promise.all(Object.entries(VENDORED).map(async ([key, { exports, name, type, version }]) => {
    const bin  = name === 'homebridge' ? { bin: { homebridge: 'bin.mjs' } } : {}
    const line = type === 'module'
               ? (value: string): string => `export const ${value} = true\n`
               : (value: string): string => `exports.${value} = true\n`

    await plant(join(scratch, 'vendor', key, 'package'), {
      'bin.mjs'      : standIn,
      'index.js'     : exports.map(line).join(''),
      'package.json' : JSON.stringify({ ...bin, main: 'index.js', name, type, version })
    })
    await pack(join(scratch, 'vendor', key), tarball(key))
  }))

  await plant(dir, {
    ...Object.fromEntries(seeds),
    ...BUILT,
    'config.schema.json'                  : JSON.stringify({
      pluginAlias : 'Luxout',
      schema      : { properties: {} }
    }),
    'package.json'                        : manifest,
    'packed/package/index.js'             : source,
    'packed/package/package.json'         : manifest,
    'tests/plugin/homebridge/config.json' : JSON.stringify({ platforms: [{ platform: 'Luxout' }] })
  })
  await exec('bun', ['install'], { cwd: dir, env })

  for (const release of RELEASES) {
    await exec('bun', ['install', '--lockfile-only'], {
      cwd: join(dir, 'tests', 'plugin', 'vet', release),
      env
    })
  }

  await pack(join(dir, 'packed'), join(dir, 'homebridge-luxout-1.2.3.tgz'))
  await mkdir(join(dir, '.mise', 'vet'), { recursive: true })
  await symlink(join(fixtures, 'vet.js'), join(dir, '.mise', 'vet', 'index.ts'))

  return dir
}

/**
 * Packs the `package` directory under `dir` into the tarball `file`, laid out
 * as `npm pack` lays one out.
 */
async function pack(dir: string, file: string): Promise<void> {
  await exec('tar', ['--create', '--directory', dir, '--file', file, '--gzip', 'package'])
}

/**
 * Runs `plugin:vet` from `cwd` on the short windows a stand-in acts within,
 * waiting up to `start` milliseconds for each to listen, under a TMPDIR
 * reached through a symlink and named to open on the checkout's path, and
 * reads back what the task left in the directory the symlink names and in the
 * storage of the floor's run with the platform block alone, beside the verdict
 * it printed for each release's run with that block.
 */
async function vet(cwd: string, scratch: string, start: number) {
  const temp = join(scratch, 'checkout-temp')

  await mkdir(temp)
  await symlink(temp, join(scratch, 'tmp'))

  const run = await sync(scratch, 'plugin:vet', {
    cwd : cwd,
    env : {
      ...scripts,
      BUN_INSTALL_CACHE_DIR : join(scratch, 'cache'),
      PWD                   : cwd,
      TUNING                : JSON.stringify({ ...TUNING, start })
    }
  })

  return {
    ...run,
    left     : await readdir(temp),
    stored   : await readdir(join(cwd, '.cache', 'vet', 'floor', 'platform-only')).catch(() => []),
    temp     : temp,
    verdicts : run.stdout.match(/^Homebridge [\d.]+, platform only: .+/gm)
  }
}

describe.concurrent('plugin:vet', () => {
  test('passes a plugin importing its dependencies and what both releases export, removing the area', async ({
    expect,
    scratch,
    task
  }) => {
    const dir                                = await checkout(scratch, CONTROL)
    const { left, status, stored, verdicts } = await vet(dir, scratch, task.timeout)

    expect({ left, status, stored, verdicts }).toEqual({
      left     : [],
      status   : 0,
      stored   : expect.arrayContaining(['written']),
      verdicts : ['Homebridge 1.8.5, platform only: passes', 'Homebridge 2.4.0, platform only: passes']
    })
  })

  test.for([
    {
      floor   : NEVER,
      message : "Cannot find package 'absent'",
      name    : 'a package its dependencies leave out',
      pinned  : NEVER,
      source  : "import 'absent'\n"
    },
    {
      floor   : NEVER,
      message : "Named export 'newer' not found",
      name    : 'a value Homebridge 1.8.5 does not export',
      pinned  : 'passes',
      source  : "import { newer } from 'homebridge'\n"
    }
  ])(
    'fails a plugin importing $name under each release lacking it, keeping the storage',
    async ({ floor, message, pinned, source }, { expect, scratch, task }) => {
      const dir                                  = await checkout(scratch, source)
      const { status, stdout, stored, verdicts } = await vet(dir, scratch, task.timeout)

      expect({ status, stdout, stored, verdicts }).toEqual({
        status   : 1,
        stdout   : expect.stringContaining(message),
        stored   : expect.arrayContaining(['config.json']),
        verdicts : [`Homebridge 1.8.5, platform only: ${floor}`, `Homebridge 2.4.0, platform only: ${pinned}`]
      })
    }
  )

  test(
    'fails before installing where the test area lies inside a checkout reached through a symlink',
    async ({ expect, scratch, task }) => {
      const link = join(scratch, 'link')

      await symlink(scratch, link)

      const { left, status, stderr, stdout, temp } = await vet(link, scratch, task.timeout)

      expect({ left, status, stderr: stderr.replace(/\/tmp\.\w+ /, '/tmp.X '), stdout }).toEqual({
        left   : [],
        status : 1,
        stderr : `The test area ${join(temp, 'tmp.X')} lies inside the checkout, where the unpacked plugin `
               + "would resolve packages from the checkout's `node_modules`, so point TMPDIR outside the "
               + 'checkout\n',
        stdout : ''
      })
    }
  )
})
