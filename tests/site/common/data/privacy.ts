import { SampleDay }    from '../../../../site/.vitepress/lib/daylight/sample-day.ts'
import { requestClock } from '../../../../site/.vitepress/lib/privacy/request-clock.ts'
import { roundedPlace } from '../../../../site/.vitepress/lib/privacy/rounded-place.ts'

const day = SampleDay.record()
/**
 * What `privacy.data.ts` yields under a build, for a case to mock it with,
 * since only VitePress runs a loader.
 */
export const data = { clock: requestClock(day), place: roundedPlace(day.window.place) }
