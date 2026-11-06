import { ClearSky }       from '../../../../../src/daylight/clear-sky.ts'
import { twilightBridge } from '../../../lib/daylight/twilight-bridge.ts'

/**
 * What `twilight-bridge.data.ts` yields under a build, for a case to mock it
 * with, since only VitePress runs a loader.
 */
export const data = twilightBridge(new ClearSky())
