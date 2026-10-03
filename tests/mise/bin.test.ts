import { execFileSync }    from 'node:child_process'
import { randomUUID }      from 'node:crypto'
import { access, constants, cp, mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir }          from 'node:os'
import { delimiter, join } from 'node:path'

import { fc, test }                        from '@fast-check/vitest'
import { afterAll, beforeAll, expect, it } from 'vitest'

const root    = join(import.meta.dirname, '..', '..')
const scratch = join(tmpdir(), `luxout-bin-${randomUUID()}`)
const bin     = join(root, '.mise', 'bin')
const copies  = join(scratch, '.mise', 'bin')
const names   = await readdir(bin)
const path    = process.env.PATH?.split(delimiter)
  .filter((entry) => entry !== bin)
  .join(delimiter)

beforeAll(async () => {
  await mkdir(scratch)
  await Promise.all(names.flatMap((name) => [
    cp(join(bin, name), join(copies, name)),
    cp(join(import.meta.dirname, 'fixtures', 'args.sh'), join(scratch, 'node_modules', '.bin', name))
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

it.each(names)('names the %s wrapper after a program installed under node_modules/.bin', async (name) => {
  await expect(access(join(root, 'node_modules', '.bin', name), constants.X_OK)).resolves.toBeUndefined()
})

it.each(names)('puts the %s wrapper first on the path mise gives a subdirectory', (name) => {
  const found = execFileSync('mise', ['x', '--', 'sh', '-c', `command -v ${name}`], {
    cwd      : join(root, 'src'),
    encoding : 'utf8',
    env      : { ...process.env, PATH: path }
  })

  expect(found.trim()).toBe(join(bin, name))
})

test.prop([fc.constantFrom(...names), fc.array(fc.string())], {
  examples: names.map((name): [string, string[]] => [name, ['holds a space', '', '*', '$HOME']])
})('passes every argument from outside the checkout to the program of its name', (name, args) => {
  const received = execFileSync(join(copies, name), args, { cwd: tmpdir(), encoding: 'utf8' })

  expect(received.split('\0').slice(0, -1)).toEqual(args)
}, 30_000)
