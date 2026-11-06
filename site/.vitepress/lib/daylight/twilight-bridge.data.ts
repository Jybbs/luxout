import { defineLoader } from 'vitepress'

import { ClearSky }                            from '../../../../src/daylight/clear-sky.ts'
import { type TwilightBridge, twilightBridge } from './twilight-bridge.ts'

declare const data: TwilightBridge

export { data }

export default defineLoader({
  load(): TwilightBridge {
    return twilightBridge(new ClearSky())
  }
})
