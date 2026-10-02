import type { PluginInitializer } from 'homebridge'

import { PLATFORM_NAME }  from './config/alias.js'
import { LuxoutPlatform } from './platform/plugin.js'

export default ((api) => api.registerPlatform(PLATFORM_NAME, LuxoutPlatform)) satisfies PluginInitializer
