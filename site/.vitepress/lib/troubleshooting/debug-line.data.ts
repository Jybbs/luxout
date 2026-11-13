import { defineLoader } from 'vitepress'

import { SampleDay }                 from '../daylight/sample-day.ts'
import { type DebugLine, debugLine } from './debug-line.ts'

declare const data: DebugLine

export { data }

export default defineLoader({
  load(): DebugLine {
    return debugLine(SampleDay.record())
  }
})
