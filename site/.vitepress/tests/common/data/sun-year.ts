import { SampleDay } from '../../../lib/daylight/sample-day.ts'
import { sunYear }   from '../../../lib/daylight/sun-year.ts'

/**
 * What `sun-year.data.ts` yields under a build, for a case to mock it with,
 * since only VitePress runs a loader.
 */
export const data = sunYear(SampleDay.record())
