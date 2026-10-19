import { HomebridgePluginUiServer } from '@homebridge/plugin-ui-utils'

import { LocationService } from './location.js'

/**
 * Answers the settings page's requests from the process the Homebridge UI
 * starts while the plugin's settings are open.
 */
class LuxoutUiServer extends HomebridgePluginUiServer {
  constructor(service: LocationService = new LocationService()) {
    super()
    this.onRequest('/check', (payload) => service.check(payload))
    this.onRequest('/search', (payload) => service.search(payload))
    this.ready()
  }
}

export const server = new LuxoutUiServer()
