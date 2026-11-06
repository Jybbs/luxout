import { RequestError }   from '@homebridge/plugin-ui-utils'
import { expect, it, vi } from 'vitest'

import { Place } from '../../src/config/place.js'
import '../../src/ui/server.js'

const { handlers, steps } = vi.hoisted(() => ({
  handlers : new Map<string, (payload: unknown) => unknown>(),
  steps    : [] as string[]
}))

vi.mock('@homebridge/plugin-ui-utils', async (original) => ({
  ...await original<object>(),
  HomebridgePluginUiServer: class {
    onRequest(path: string, handler: (payload: unknown) => unknown): void {
      handlers.set(path, handler)
      steps.push(path)
    }

    ready(): void {
      steps.push('ready')
    }
  }
}))

it('registers the check and the search before it reports ready', () => {
  expect(steps).toStrictEqual(['/check', '/search', 'ready'])
})

it('answers the check with the place the coordinates round to', () => {
  const place = handlers.get('/check')?.({ latitude: 42.35843, longitude: -71.05977 })

  expect(place).toStrictEqual(new Place(42.36, -71.06))
})

it('answers the search through the location service', async () => {
  await expect(handlers.get('/search')?.({ language: 'en' }))
    .rejects.toStrictEqual(new RequestError('missing_value at .query (missing value)', expect.any(Array)))
})
