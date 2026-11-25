import { theGap }    from '../../../../site/.vitepress/lib/daylight/gap.ts'
import { luxScale }  from '../../../../site/.vitepress/lib/daylight/lux-scale.ts'
import { SampleDay } from '../../../../site/.vitepress/lib/daylight/sample-day.ts'

const day = SampleDay.record()
/**
 * What `daylight.data.ts` yields under a build, for a case to mock it with,
 * since only VitePress runs a loader.
 */
export const data = { gap: theGap(day), luxScale: luxScale(day) }
