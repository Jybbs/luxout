import { spawnSync }     from 'node:child_process'
import { tmpdir }        from 'node:os'
import { join }          from 'node:path'
import { pathToFileURL } from 'node:url'

import { expect, it, vi } from 'vitest'

import * as monitor from '../../../.mise/vet/monitor.ts'
import { test }     from '../../common/vet.js'

const vet = join(import.meta.dirname, '..', '..', '..', '.mise', 'vet')

/**
 * Builds a stand-in for `fs` whose every write call returns its name, and
 * watches it for writes outside `storage`, where `area` names the directory
 * Homebridge runs from.
 */
function watched(storage = '/storage', area = '/area') {
  const report  = vi.fn<(line: string) => void>()
  const call    = (name: string) => vi.fn<(...args: unknown[]) => string>(() => name)
  const promise = (name: string) => vi.fn<(...args: unknown[]) => Promise<string>>(async () => name)
  const fs      = {
    copyFile          : call('copyFile'),
    cp                : call('cp'),
    createWriteStream : call('createWriteStream'),
    mkdirSync         : call('mkdirSync'),
    mkdtemp           : call('mkdtemp'),
    readFile          : call('readFile'),
    rename            : call('rename'),
    writeFileSync     : call('writeFileSync'),
    promises          : { appendFile: promise('appendFile'), writeFile: promise('writeFile') }
  }

  new monitor.Writes(storage, area, report).watch(fs)

  return { fs, report }
}

/**
 * Builds a stand-in for `dns` whose lookups resolve every host to 127.0.0.1,
 * and fails its lookups.
 */
function failed() {
  const report   = vi.fn<(line: string) => void>()
  const promised = vi.fn<(host: string) => Promise<object>>(async () => ({ address: '127.0.0.1', family: 4 }))
  const lookup   = vi.fn<(...args: unknown[]) => void>((...args) => {
    const callback = args.at(-1)

    if (typeof callback === 'function') callback(null, '127.0.0.1', 4)
  })
  const resolver = { NOTFOUND: 'ENOTFOUND', lookup, promises: { lookup: promised } }

  monitor.failLookups(resolver, report)

  return { lookup, promised, report, resolver }
}

it.each([
  { args: ['/elsewhere/a.json', '{}'], name: 'writeFileSync', path: '/elsewhere/a.json' },
  { args: ['/storage/a.json', '/elsewhere/b.json'], name: 'copyFile', path: '/elsewhere/b.json' },
  { args: ['/storage/a.json', '/elsewhere/c.json'], name: 'rename', path: '/elsewhere/c.json' },
  { args: [new URL('file:///elsewhere/d')], name: 'mkdirSync', path: '/elsewhere/d' },
  { args: ['/storage/e', '/elsewhere/e'], name: 'cp', path: '/elsewhere/e' },
  { args: ['/elsewhere/f.log'], name: 'createWriteStream', path: '/elsewhere/f.log' },
  { args: ['/elsewhere/g-'], name: 'mkdtemp', path: '/elsewhere/g-' }
])('reports $name reaching $path and passes the call on', ({ args, name, path }) => {
  const { fs, report } = watched()

  expect({ answer: Reflect.apply(Reflect.get(fs, name), fs, args), lines: report.mock.calls.flat() })
    .toEqual({ answer: name, lines: [`${monitor.OUTSIDE} ${path}`] })
})

it('reports a write through the promise form', async () => {
  const { fs, report } = watched()

  await fs.promises.appendFile('/elsewhere/log.txt', 'x')
  await fs.promises.writeFile('/elsewhere/a.json', '{}')

  expect(report.mock.calls.flat()).toEqual([
    `${monitor.OUTSIDE} /elsewhere/log.txt`,
    `${monitor.OUTSIDE} /elsewhere/a.json`
  ])
})

it.each([
  { name: 'the storage directory', path: '/storage/luxout-forecast.json' },
  { name: 'the system temp directory', path: join(tmpdir(), 'scratch.json') },
  { name: '/tmp', path: '/tmp/scratch.json' }
])('reports nothing written inside $name', ({ path }) => {
  const { fs, report } = watched()

  fs.writeFileSync(path, '')

  expect(report).not.toHaveBeenCalled()
})

it(
  'reports a write into the directory Homebridge runs from lying in the temp directory, passing its storage',
  () => {
    const area           = join(tmpdir(), 'area')
    const { fs, report } = watched(join(area, 'storage'), area)

    fs.writeFileSync(join(area, 'node_modules', 'homebridge-luxout', 'cache.json'), '')
    fs.writeFileSync(join(area, 'storage', 'luxout-forecast.json'), '')
    fs.writeFileSync(join(tmpdir(), 'scratch.json'), '')

    expect(report.mock.calls.flat()).toEqual([
      `${monitor.OUTSIDE} ${join(area, 'node_modules', 'homebridge-luxout', 'cache.json')}`
    ])
  }
)

it('reports a path once however often it is written', () => {
  const { fs, report } = watched()

  fs.writeFileSync('/elsewhere/a.json', '')
  fs.writeFileSync('/elsewhere/a.json', '')

  expect(report).toHaveBeenCalledOnce()
})

it('reads nothing into a write through a file descriptor', () => {
  const { fs, report } = watched()

  fs.writeFileSync(3, '')

  expect(report).not.toHaveBeenCalled()
})

it('leaves a call that writes nothing as it was', () => {
  const { fs, report } = watched()

  fs.readFile('/elsewhere/a.json')

  expect(report).not.toHaveBeenCalled()
})

it('fails the lookup of a host as ENOTFOUND without resolving it', async () => {
  const { lookup, report, resolver } = failed()
  const callback                     = vi.fn<(...args: unknown[]) => void>()

  resolver.lookup('api.open-meteo.com', { all: false }, callback)
  await vi.waitFor(() => expect(callback).toHaveBeenCalled())

  expect({
    error    : callback.mock.calls[0]?.[0],
    lines    : report.mock.calls.flat(),
    resolved : lookup.mock.calls
  }).toEqual({
    error    : expect.objectContaining({
      code     : 'ENOTFOUND',
      errno    : -3008,
      hostname : 'api.open-meteo.com',
      message  : 'getaddrinfo ENOTFOUND api.open-meteo.com',
      syscall  : 'getaddrinfo'
    }),
    lines    : ['Fails the lookup of api.open-meteo.com as ENOTFOUND'],
    resolved : []
  })
})

it('rejects the promised lookup of a host as ENOTFOUND', async () => {
  const { promised, resolver } = failed()

  await expect(resolver.promises.lookup('api.open-meteo.com')).rejects.toMatchObject({ code: 'ENOTFOUND' })
  expect(promised).not.toHaveBeenCalled()
})

it.each(['localhost', '127.0.0.1', '::1'])('resolves %s as it would have', async (host) => {
  const { lookup, promised, report, resolver } = failed()
  const callback                               = vi.fn<(...args: unknown[]) => void>()

  resolver.lookup(host, callback)

  expect({
    callback : callback.mock.calls,
    promised : await resolver.promises.lookup(host),
    reported : report.mock.calls,
    resolved : [lookup.mock.calls.length, promised.mock.calls.length]
  }).toEqual({
    callback : [[null, '127.0.0.1', 4]],
    promised : { address: '127.0.0.1', family: 4 },
    reported : [],
    resolved : [1, 1]
  })
})

test('reports a write the write preload sees from a module importing fs by name', async ({
  outside,
  scratch
}) => {
  const file   = join(outside, 'outside.json')
  const script = "import { writeFile } from 'node:fs/promises'\n"
               + `await writeFile(${JSON.stringify(file)}, '')`

  const { stderr } = spawnSync(
    process.execPath,
    ['--import', pathToFileURL(join(vet, 'writes.ts')).href, '--input-type=module', '--eval', script],
    { encoding: 'utf8', env: { ...process.env, HB_STORAGE_PATH: join(scratch, 'storage') } }
  )

  expect(stderr).toBe(`${monitor.OUTSIDE} ${file}\n`)
})

test('reports a write the write preload sees inside the directory Homebridge runs from', ({ scratch }) => {
  const script = "import { mkdirSync, writeFileSync } from 'node:fs'\n"
               + "mkdirSync('storage')\n"
               + "writeFileSync('storage/kept.json', '')\n"
               + "writeFileSync('written.json', '')"

  const { stderr } = spawnSync(
    process.execPath,
    ['--import', pathToFileURL(join(vet, 'writes.ts')).href, '--input-type=module', '--eval', script],
    {
      cwd      : scratch,
      encoding : 'utf8',
      env      : { ...process.env, HB_STORAGE_PATH: join(scratch, 'storage'), TMPDIR: scratch }
    }
  )

  expect(stderr).toBe(`${monitor.OUTSIDE} ${join(scratch, 'written.json')}\n`)
})

test('fails a fetch under the offline preload before it leaves the machine', () => {
  const script = "await fetch('https://api.open-meteo.com').catch((error) => console.log(error.cause.code))"

  const { stdout } = spawnSync(
    process.execPath,
    ['--import', pathToFileURL(join(vet, 'offline.ts')).href, '--input-type=module', '--eval', script],
    { encoding: 'utf8' }
  )

  expect(stdout).toBe('ENOTFOUND\n')
})
