/** @vitest-environment happy-dom */
import { once } from 'node:events'

import { MockHomebridgePluginUi } from '@homebridge/plugin-ui-utils/ui.mock'
import { expect, it, vi }         from 'vitest'

import { LocationPage } from '../../../src/ui/public/page.js'

it('opens the page once the Homebridge UI is ready, logging a page that fails to open', async () => {
  const failure    = new TypeError('The page holds no #search')
  const homebridge = new MockHomebridgePluginUi()
  const log        = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const open       = vi.spyOn(LocationPage, 'open').mockRejectedValue(failure)

  await once(homebridge, 'ready')
  vi.stubGlobal('homebridge', homebridge)
  await import('../../../src/ui/public/index.js')

  expect(open).not.toHaveBeenCalled()

  homebridge.dispatchEvent(new Event('ready'))

  expect(open).toHaveBeenCalledExactlyOnceWith(document, homebridge)
  await vi.waitFor(() => {
    expect(log).toHaveBeenCalledExactlyOnceWith(failure)
  })
})
