import { SampleDay } from '../../../lib/daylight/sample-day.ts'
import { debugLine } from '../../../lib/troubleshooting/debug-line.ts'

/**
 * What `debug-line.data.ts` yields under a build, for a case to mock it with,
 * since only VitePress runs a loader.
 */
export const data = debugLine(SampleDay.record())
