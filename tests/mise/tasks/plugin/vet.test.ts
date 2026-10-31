import { execFileSync }                      from 'node:child_process'
import { mkdir, readFile, readdir, symlink } from 'node:fs/promises'
import { join }                              from 'node:path'

import { expect } from 'vitest'

import { plant, test } from '../../../common/scratch.js'
import { sync }        from '../../../common/sync.js'
import { TUNING }      from '../../../common/vet.js'

/**
 * A package the fixture checkout installs from a tarball of its own, exporting
 * `true` under each name `exports` lists.
 */
interface Vendored {
  exports : string[]
  name    : string
  version : string
}

/**
 * The source of a plugin that imports its one dependency and a value both
 * releases export, then writes into its storage through the path the storage
 * resolves to.
 */
const CONTROL = "import { realpathSync, writeFileSync } from 'node:fs'\n"
              + "import { shared } from 'homebridge'\n"
              + "import { present } from 'present'\n"
              + "writeFileSync(realpathSync(process.env.HB_STORAGE_PATH) + '/written', '')\n"
const NEVER    = 'fails, since it never initializes the Luxout platform'
const RELEASES = ['floor', 'pinned'] as const
/**
 * The packages the fixture checkout installs, where `floor` stands in for
 * Homebridge 1.8.5 and `pinned` for 2.4.0, the one the checkout's
 * devDependencies install.
 */
const VENDORED = {
  absent  : { exports: ['absent'], name: 'absent', version: '1.0.0' },
  floor   : { exports: ['shared'], name: 'homebridge', version: '1.8.5' },
  pinned  : { exports: ['newer', 'shared'], name: 'homebridge', version: '2.4.0' },
  present : { exports: ['present'], name: 'present', version: '1.0.0' }
} satisfies Record<string, Vendored>
const fixtures = join(import.meta.dirname, '..', '..', 'fixtures')
const root     = join(import.meta.dirname, '..', '..', '..', '..')

/**
 * Builds a checkout under `scratch` whose packed plugin runs `source`, beside a
 * seed for each release and a `node_modules` holding every package its manifest
 * declares, the devDependencies `absent` and the 2.4.0 stand-in among them.
 */
async function checkout(scratch: string, source: string): Promise<string> {
  const dir      = join(scratch, 'checkout')
  const env      = { BUN_INSTALL_CACHE_DIR: join(scratch, 'cache'), PATH: process.env.PATH }
  const bunfig   = await readFile(join(root, 'bunfig.toml'), 'utf8')
  const standIn  = await readFile(join(fixtures, 'homebridge.js'), 'utf8')
  const tarball  = (key: string): string => join(scratch, 'vendor', `${key}.tgz`)
  const manifest = JSON.stringify({
    dependencies    : { present: tarball('present') },
    devDependencies : { absent: tarball('absent'), homebridge: tarball('pinned') },
    main            : 'index.js',
    name            : 'homebridge-luxout',
    type            : 'module',
    version         : '1.2.3'
  })
  const seeds = RELEASES.flatMap((release) => [
    [`tests/vet/${release}/bunfig.toml`, bunfig],
    [`tests/vet/${release}/package.json`, JSON.stringify({ dependencies: { homebridge: tarball(release) } })]
  ])

  for (const [key, { exports, name, version }] of Object.entries(VENDORED)) {
    const bin = name === 'homebridge' ? { bin: { homebridge: 'bin.js' } } : {}

    await plant(join(scratch, 'vendor', key, 'package'), {
      'bin.js'       : standIn,
      'index.js'     : exports.map((value) => `export const ${value} = true\n`).join(''),
      'package.json' : JSON.stringify({ ...bin, main: 'index.js', name, type: 'module', version })
    })
    pack(join(scratch, 'vendor', key), tarball(key))
  }

  await plant(dir, {
    ...Object.fromEntries(seeds),
    'bunfig.toml'                 : bunfig,
    'config.schema.json'          : JSON.stringify({ pluginAlias: 'Luxout', schema: { properties: {} } }),
    'package.json'                : manifest,
    'packed/package/index.js'     : source,
    'packed/package/package.json' : manifest
  })
  execFileSync('bun', ['install'], { cwd: dir, env, stdio: 'pipe' })

  for (const release of RELEASES) {
    execFileSync('bun', ['install', '--lockfile-only'], {
      cwd   : join(dir, 'tests', 'vet', release),
      env   : env,
      stdio : 'pipe'
    })
  }

  pack(join(dir, 'packed'), join(dir, 'homebridge-luxout-1.2.3.tgz'))
  await mkdir(join(dir, '.mise', 'vet'), { recursive: true })
  await symlink(join(fixtures, 'vet.js'), join(dir, '.mise', 'vet', 'index.ts'))

  return dir
}

/**
 * Packs the `package` directory under `dir` into the tarball `file`, laid out as
 * `npm pack` lays one out.
 */
function pack(dir: string, file: string): void {
  execFileSync('tar', ['--create', '--directory', dir, '--file', file, '--gzip', 'package'])
}

/**
 * Runs `plugin:vet` from `cwd` on the short waits a stand-in starts within,
 * under a TMPDIR reached through a symlink, and reads back what the task left in
 * the directory the symlink names, beside the verdict it printed for each
 * release's run with the platform block alone.
 */
async function vet(scratch: string, cwd: string) {
  const temp = join(scratch, 'temp')

  await mkdir(temp)
  await symlink(temp, join(scratch, 'tmp'))

  const run = await sync(scratch, 'plugin:vet', {
    cwd : cwd,
    env : { BUN_INSTALL_CACHE_DIR: join(scratch, 'cache'), TUNING: JSON.stringify(TUNING) }
  })

  return {
    ...run,
    left     : await readdir(temp),
    temp     : temp,
    verdicts : run.stdout.match(/^Homebridge [\d.]+, platform only: .+/gm)
  }
}

test('passes a plugin importing its dependencies and what both releases export, removing the area', async ({
  scratch
}) => {
  const { left, status, verdicts } = await vet(scratch, await checkout(scratch, CONTROL))

  expect({ left, status, verdicts }).toEqual({
    left     : [],
    status   : 0,
    verdicts : ['Homebridge 1.8.5, platform only: passes', 'Homebridge 2.4.0, platform only: passes']
  })
}, 120_000)

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
    message : "does not provide an export named 'newer'",
    name    : 'a value Homebridge 1.8.5 does not export',
    pinned  : 'passes',
    source  : "import { newer } from 'homebridge'\n"
  }
])(
  'fails a plugin importing $name under each release lacking it',
  { timeout: 120_000 },
  async ({ floor, message, pinned, source }, { scratch }) => {
    const { status, stdout, verdicts } = await vet(scratch, await checkout(scratch, source))

    expect({ status, stdout, verdicts }).toEqual({
      status   : 1,
      stdout   : expect.stringContaining(message),
      verdicts : [`Homebridge 1.8.5, platform only: ${floor}`, `Homebridge 2.4.0, platform only: ${pinned}`]
    })
  }
)

test('fails before installing anything where the test area lies inside the checkout', async ({ scratch }) => {
  const { left, status, stderr, stdout, temp } = await vet(scratch, scratch)

  expect({ left, status, stderr: stderr.replace(/\/tmp\.\w+ /, '/tmp.X '), stdout }).toEqual({
    left   : [],
    status : 1,
    stderr : `The test area ${join(temp, 'tmp.X')} lies inside the checkout, where the unpacked plugin would `
           + "resolve packages from the checkout's `node_modules`, so point TMPDIR outside the checkout\n",
    stdout : ''
  })
})
