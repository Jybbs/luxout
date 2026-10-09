import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { join }                      from 'node:path'

import { expect, vi } from 'vitest'

import { Place }       from '../../src/config/place.js'
import { WindowStore } from '../../src/weather/store.js'
import { test }        from '../common/scratch.js'
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

test('reads back the window it writes', async ({ scratch }) => {
  const store = new WindowStore(scratch)

  await store.write(window)

  await expect(store.read(place)).resolves.toEqual(window)
})

test('writes one file under the storage directory and nothing beside it', async ({ scratch }) => {
  await new WindowStore(scratch).write(window)

  await expect(readdir(scratch)).resolves.toEqual([FILE])
})

test('flushes the window to a temporary file before moving it into place', async ({ scratch }) => {
  await new WindowStore(scratch).write(window)

  expect(writeFile).toHaveBeenLastCalledWith(join(scratch, `${FILE}.tmp`), JSON.stringify(window), {
    flush: true
  })
})

test('keeps the previous window when a write stops partway', async ({ scratch }) => {
  const store    = new WindowStore(scratch)
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

test('reads no window from a storage directory holding none', async ({ scratch }) => {
  await expect(new WindowStore(scratch).read(place)).resolves.toBeUndefined()
})

test.for([
  { contents: '{"latitude":42.36,', name: 'a file that is not JSON' },
  { contents: '{}', name: 'JSON that holds no window' },
  {
    contents : JSON.stringify({ ...window.toJSON(), minutely_15: { time: [] } }),
    name     : 'a window missing its irradiances'
  }
])('reads no window from $name', async ({ contents }, { scratch }) => {
  await writeFile(join(scratch, FILE), contents)

  await expect(new WindowStore(scratch).read(place)).resolves.toBeUndefined()
})

test('reads no window fetched for other coordinates', async ({ scratch }) => {
  const store = new WindowStore(scratch)

  await store.write(window)

  await expect(store.read(other)).resolves.toBeUndefined()
})

test('rejects on a read error other than a missing file', async ({ scratch }) => {
  await mkdir(join(scratch, FILE))

  await expect(new WindowStore(scratch).read(place)).rejects.toMatchObject({ code: 'EISDIR' })
})
