import { factorDay } from '../../../../site/.vitepress/lib/daylight/factor-day.ts'
import { SampleDay } from '../../../../site/.vitepress/lib/daylight/sample-day.ts'

/**
 * What `factor-day.data.ts` yields under a build, for a case to mock it with,
 * since only VitePress runs a loader.
 */
export const data = factorDay(SampleDay.record())
