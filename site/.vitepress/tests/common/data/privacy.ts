import { SampleDay }    from '../../../lib/daylight/sample-day.ts'
import { requestClock } from '../../../lib/privacy/request-clock.ts'
import { roundedPlace } from '../../../lib/privacy/rounded-place.ts'

const day = SampleDay.record()
/**
 * What `privacy.data.ts` yields under a build, for a case to mock it with,
 * since only VitePress runs a loader.
 */
export const data = { clock: requestClock(day), place: roundedPlace(day.window.place) }
