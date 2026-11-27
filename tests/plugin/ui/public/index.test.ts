/** @vitest-environment happy-dom */
import { once }         from 'node:events'
import { setImmediate } from 'node:timers/promises'

import { MockHomebridgePluginUi } from '@homebridge/plugin-ui-utils/ui.mock'
import { expect, it, vi }         from 'vitest'

it.each([
  ['a markup error', new TypeError('The page holds no #search'), 'The page holds no #search'],
  ['a failed UI reply', { message: 'Failed to load the config' }, 'Failed to load the config']
])('opens the page once the Homebridge UI is ready, toasting %s', async (_, failure, shown) => {
  const homebridge = new MockHomebridgePluginUi()
  const toast      = vi.spyOn(homebridge.toast, 'error')

  await once(homebridge, 'ready')
  vi.stubGlobal('homebridge', homebridge)
  vi.resetModules()

  const { LocationPage } = await import('../../../../src/ui/public/page.js')
  const open             = vi.spyOn(LocationPage, 'open').mockRejectedValue(failure)

  await import('../../../../src/ui/public/index.js')

  expect(open).not.toHaveBeenCalled()

  homebridge.dispatchEvent(new Event('ready'))

  expect(open).toHaveBeenCalledExactlyOnceWith(document, homebridge)
  await setImmediate()
  expect(toast).toHaveBeenCalledExactlyOnceWith(shown)
})
