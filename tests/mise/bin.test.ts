import { execFileSync }                                 from 'node:child_process'
import { cp, mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises'
import { tmpdir }                                       from 'node:os'
import { delimiter, join }                              from 'node:path'

import { fc, test }                        from '@fast-check/vitest'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { parse }                           from 'yaml'

interface Lockfile {
  packages: Record<string, [string, string, { bin?: Record<string, string> | string }?]>
}

const LOCKFILES = ['bun.lock', 'site/bun.lock']
const fixture   = join(import.meta.dirname, 'fixtures', 'args.sh')
const root      = join(import.meta.dirname, '..', '..')
const scratch   = await realpath(await mkdtemp(join(tmpdir(), 'luxout-bin-')))
const bin       = join(root, '.mise', 'bin')
const copies    = join(scratch, '.mise', 'bin')

const installed = (await Promise.all(LOCKFILES.map(async (file) => {
  const { packages }: Lockfile = parse(await readFile(join(root, file), 'utf8'))

  return Object.values(packages)
    .flatMap(([, , { bin: programs } = {}]) => typeof programs === 'object' ? Object.keys(programs) : [])
}))).flat()

const site  = join(scratch, 'site')
const names = await readdir(bin)
const path  = process.env.PATH?.split(delimiter)
  .filter((entry) => entry !== bin)
  .join(delimiter)

const program = (directory: string, name: string): string => join(directory, 'node_modules', '.bin', name)

beforeAll(async () => {
  await Promise.all(names.flatMap((name) => [
    cp(join(bin, name), join(copies, name)),
    ...[scratch, site].map((directory) => cp(fixture, program(directory, name)))
  ]))
})

afterAll(() => rm(scratch, { force: true, recursive: true }))

it('keeps every wrapper a regular file holding the same bytes as the first', async () => {
  const wrappers = await Promise.all((await readdir(bin, { withFileTypes: true })).map(async (entry) => ({
    bytes : await readFile(join(bin, entry.name)),
    file  : entry.isFile(),
    name  : entry.name
  })))

  expect(wrappers).toEqual(names.map((name) => ({ bytes: wrappers[0]?.bytes, file: true, name })))
})

it.each(names)('names the %s wrapper after a program bun.lock or site/bun.lock installs', (name) => {
  expect(installed).toContain(name)
})

it.each(names)('puts the %s wrapper first on the path mise gives a subdirectory', (name) => {
  const found = execFileSync('mise', ['x', '--', 'sh', '-c', `command -v ${name}`], {
    cwd      : join(root, 'src'),
    encoding : 'utf8',
    env      : { ...process.env, PATH: path }
  })

  expect(found.trim()).toBe(join(bin, name))
})

it.each(names)('runs the %s that the node_modules/.bin of the directory it starts in holds', (name) => {
  const received = execFileSync(join(copies, name), ['site'], { cwd: site, encoding: 'utf8' })

  expect(received.split('\0').slice(0, -1)).toEqual([program(site, name), 'site'])
})

test.prop([fc.constantFrom(...names), fc.array(fc.string())], {
  examples: names.map((name): [string, string[]] => [name, ['holds a space', '', '*', '$HOME']])
})('passes every argument from outside the checkout to the program of its name', (name, args) => {
  const received = execFileSync(join(copies, name), args, { cwd: tmpdir(), encoding: 'utf8' })

  expect(received.split('\0').slice(0, -1)).toEqual([program(scratch, name), ...args])
}, 30_000)
