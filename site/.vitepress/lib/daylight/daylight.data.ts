import { defineLoader } from 'vitepress'

import { type Gap, theGap }           from './gap.ts'
import { type DecadeScale, luxScale } from './lux-scale.ts'
import { SampleDay }                  from './sample-day.ts'

interface Daylight {
  gap      : Gap
  luxScale : DecadeScale
}

declare const data: Daylight

export { data }

export default defineLoader({
  watch: ['./forecast.json', '../search/recording.json'],
  load(): Daylight {
    const day = SampleDay.record()

    return { gap: theGap(day), luxScale: luxScale(day) }
  }
})
