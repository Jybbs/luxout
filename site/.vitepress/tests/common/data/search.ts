import { replaySearch } from '../../../lib/search/replay.ts'

/**
 * What `search.data.ts` yields under a build, for a case to mock it with, since
 * only VitePress runs a loader.
 */
export const data = await replaySearch()
