import { defineLoader } from 'vitepress'

import { type SearchReplay, replaySearch } from './replay.ts'

declare const data: SearchReplay

export { data }

export default defineLoader({
  load  : replaySearch,
  watch : ['../../../../config.schema.json', './recording.json']
})
