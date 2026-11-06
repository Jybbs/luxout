import { defineLoader } from 'vitepress'

import { type CloudSteps, cloudSteps } from './cloud-steps.ts'
import { SampleDay }                   from './sample-day.ts'

declare const data: CloudSteps

export { data }

export default defineLoader({
  load(): CloudSteps {
    return cloudSteps(SampleDay.record())
  }
})
