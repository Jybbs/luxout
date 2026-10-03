import type { PluginInitializer } from 'homebridge'

import schema             from '../config.schema.json' with { type: 'json' }
import { LuxoutPlatform } from './platform/dynamic.js'

export default ((api) => api.registerPlatform(schema.pluginAlias, LuxoutPlatform)) satisfies PluginInitializer
