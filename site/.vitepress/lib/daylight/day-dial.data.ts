import { defineLoader } from 'vitepress'

import { type DayDial, dayDial } from './day-dial.ts'
import { SampleDay }             from './sample-day.ts'

declare const data: DayDial

export { data }

export default defineLoader({
  load(): DayDial {
    return dayDial(SampleDay.record())
  }
})
