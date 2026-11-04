import { theGap }    from '../../../lib/daylight/gap.ts'
import { luxScale }  from '../../../lib/daylight/lux-scale.ts'
import { SampleDay } from '../../../lib/daylight/sample-day.ts'

const day = SampleDay.record()
/**
 * What `daylight.data.ts` yields under a build, for a case to mock it with,
 * since only VitePress runs a loader.
 */
export const data = { gap: theGap(day), luxScale: luxScale(day) }
