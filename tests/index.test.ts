import type { API }       from 'homebridge'
import { expect, it, vi } from 'vitest'

import plugin             from '../src/index.js'
import { LuxoutPlatform } from '../src/platform/dynamic.js'

it('registers LuxoutPlatform under the platform name Luxout', () => {
  const registerPlatform = vi.fn<(...args: unknown[]) => void>()

  plugin({ registerPlatform } as Partial<API> as API)

  expect(registerPlatform).toHaveBeenCalledExactlyOnceWith('Luxout', LuxoutPlatform)
})
