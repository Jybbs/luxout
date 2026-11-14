import { defineLoader } from 'vitepress'

import { type SearchReplay, replaySearch, replaySources } from './replay.ts'

declare const data: SearchReplay

export { data }

export default defineLoader({
  load  : replaySearch,
  watch : replaySources
})
