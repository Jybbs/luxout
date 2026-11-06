import { defineLoader } from 'vitepress'

import { type FactorDay, factorDay } from './factor-day.ts'
import { SampleDay }                 from './sample-day.ts'

declare const data: FactorDay

export { data }

export default defineLoader({
  load(): FactorDay {
    return factorDay(SampleDay.record())
  }
})
