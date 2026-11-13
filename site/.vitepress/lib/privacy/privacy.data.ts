import { defineLoader } from 'vitepress'

import { SampleDay }                       from '../daylight/sample-day.ts'
import { type RequestClock, requestClock } from './request-clock.ts'
import { type RoundedPlace, roundedPlace } from './rounded-place.ts'

/**
 * The hour of requests and the rounded place the Privacy section draws.
 */
export interface Privacy {
  readonly clock : RequestClock
  readonly place : RoundedPlace
}

declare const data: Privacy

export { data }

export default defineLoader({
  load(): Privacy {
    const day = SampleDay.record()

    return { clock: requestClock(day), place: roundedPlace(day.window.place) }
  }
})
