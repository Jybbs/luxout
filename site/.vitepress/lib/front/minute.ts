import { createGlobalState } from '@vueuse/core'
import { range }             from 'd3-array'
import { shallowRef }        from 'vue'

import { DAY_MINUTES }         from '../daylight/clock.ts'
import { type Facts, factsAt } from './facts.ts'
import { data }                from './front.data.ts'

/**
 * Reads the figures of every whole minute of the sample day, built once on the
 * first call, so a drawing that moves through the day writes strings already
 * made.
 */
export const useFrontFacts = createGlobalState((): readonly Facts[] =>
  range(DAY_MINUTES + 1).map((minute) => factsAt(data.day, minute))
)

/**
 * Reads the minute of the sample day the front page shows, one value the
 * hero's scroll and the Day Strip's slider both write and every drawing on the
 * page reads, starting at noon.
 */
export const useFrontMinute = createGlobalState(() => shallowRef(data.day.noon))
