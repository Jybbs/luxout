import { dayDial }   from '../../../../site/.vitepress/lib/daylight/day-dial.ts'
import { SampleDay } from '../../../../site/.vitepress/lib/daylight/sample-day.ts'

/**
 * What `day-dial.data.ts` yields under a build, for a case to mock it with,
 * since only VitePress runs a loader.
 */
export const data = dayDial(SampleDay.record())
