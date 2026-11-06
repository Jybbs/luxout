import { defineLoader } from 'vitepress'

import { SampleDay }             from './sample-day.ts'
import { type SunYear, sunYear } from './sun-year.ts'

declare const data: SunYear

export { data }

export default defineLoader({
  load(): SunYear {
    return sunYear(SampleDay.record())
  }
})
