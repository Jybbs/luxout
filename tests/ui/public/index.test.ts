import { once } from 'node:events'

import { MockHomebridgePluginUi } from '@homebridge/plugin-ui-utils/ui.mock'
import { expect, it, vi }         from 'vitest'

it('shows the form the Homebridge UI generates below the page once the UI is ready', async () => {
  const homebridge = new MockHomebridgePluginUi()
  const show       = vi.spyOn(homebridge, 'showSchemaForm')

  await once(homebridge, 'ready')
  vi.stubGlobal('window', { homebridge })
  await import('../../../src/ui/public/index.js')

  expect(show).not.toHaveBeenCalled()

  homebridge.dispatchEvent(new Event('ready'))

  expect(show).toHaveBeenCalledOnce()
})
