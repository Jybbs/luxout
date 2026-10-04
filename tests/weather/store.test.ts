import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir }                                  from 'node:os'
import { join }                                    from 'node:path'

import { expect, it, onTestFinished, vi } from 'vitest'

import { Place }       from '../../src/config/place.js'
import { WindowStore } from '../../src/weather/store.js'
import { parsed }      from '../common/window.js'
import forecast        from './fixtures/forecast.json' with { type: 'json' }

vi.mock(import('node:fs/promises'), async (original) => {
  const fs = await original()

  return { ...fs, writeFile: vi.fn<typeof fs.writeFile>(fs.writeFile) }
})

const FILE   = 'luxout-forecast.json'
const other  = new Place(40.71, -74.01)
const place  = new Place(42.35843, -71.05977)
const window = parsed(forecast, place)

it('reads back the window it writes', async () => {
  const store = new WindowStore(await scratch())

  await store.write(window)

  await expect(store.read(place)).resolves.toEqual(window)
})

it('writes one file under the storage directory and nothing beside it', async () => {
  const storage = await scratch()

  await new WindowStore(storage).write(window)

  await expect(readdir(storage)).resolves.toEqual([FILE])
})

it('flushes the window to a temporary file before moving it into place', async () => {
  const storage = await scratch()

  await new WindowStore(storage).write(window)

  expect(writeFile).toHaveBeenLastCalledWith(join(storage, `${FILE}.tmp`), JSON.stringify(window), {
    flush: true
  })
})

it('keeps the previous window when a write stops partway', async () => {
  const store    = new WindowStore(await scratch())
  const write    = vi.mocked(writeFile)
  const original = write.getMockImplementation()

  await store.write(window)
  write.mockImplementationOnce(async (file) => {
    await original?.(file, '{"latitude":40.71,"longitude":-74.01,"minu')
    throw new Error('ENOSPC: no space left on device, write')
  })

  await expect(store.write(parsed(forecast, other))).rejects.toThrow('ENOSPC')
  await expect(store.read(place)).resolves.toEqual(window)
})

it('reads no window from a storage directory holding none', async () => {
  await expect(new WindowStore(await scratch()).read(place)).resolves.toBeUndefined()
})

it.each([
  { contents: '{"latitude":42.36,', name: 'a file that is not JSON' },
  { contents: '{}', name: 'JSON that holds no window' },
  {
    contents : JSON.stringify({ ...window.toJSON(), minutely_15: { time: [] } }),
    name     : 'a window missing its irradiances'
  }
])('reads no window from $name', async ({ contents }) => {
  const storage = await scratch()

  await writeFile(join(storage, FILE), contents)

  await expect(new WindowStore(storage).read(place)).resolves.toBeUndefined()
})

it('reads no window fetched for other coordinates', async () => {
  const store = new WindowStore(await scratch())

  await store.write(window)

  await expect(store.read(other)).resolves.toBeUndefined()
})

it('rejects on a read error other than a missing file', async () => {
  const storage = await scratch()

  await mkdir(join(storage, FILE))

  await expect(new WindowStore(storage).read(place)).rejects.toMatchObject({ code: 'EISDIR' })
})

async function scratch(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'luxout-store-'))

  onTestFinished(() => rm(directory, { force: true, recursive: true }))

  return directory
}
