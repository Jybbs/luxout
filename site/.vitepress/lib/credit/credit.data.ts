import { defineLoader } from 'vitepress'

import type { SealMarks } from './seal-drawing.ts'
import { Seal }           from './seal.ts'

declare const data: SealMarks

export { data }

export default defineLoader({
  async load(): Promise<SealMarks> {
    return (await Seal.read(new URL('../../', import.meta.url))).marks
  }
})
