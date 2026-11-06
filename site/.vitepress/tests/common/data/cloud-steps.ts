import { cloudSteps } from '../../../lib/daylight/cloud-steps.ts'
import { SampleDay }  from '../../../lib/daylight/sample-day.ts'

/**
 * What `cloud-steps.data.ts` yields under a build, for a case to mock it with,
 * since only VitePress runs a loader.
 */
export const data = cloudSteps(SampleDay.record())
