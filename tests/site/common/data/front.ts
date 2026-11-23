import { pathToFileURL } from 'node:url'

import { Bibliography } from '../../../../site/.vitepress/lib/citations/bibliography.ts'
import { SampleDay }    from '../../../../site/.vitepress/lib/daylight/sample-day.ts'
import { frontPage }    from '../../../../site/.vitepress/lib/front/front.ts'
import { Logo }         from '../../../../site/.vitepress/lib/logo/logo.ts'
import recording        from '../../../../site/.vitepress/lib/search/recording.json' with { type: 'json' }
import { Tokens }       from '../../../../site/.vitepress/lib/theme/tokens.ts'

const root                         = pathToFileURL(`${import.meta.dirname}/../../../`)
const [bibliography, logo, tokens] = await Promise.all([
  Bibliography.read(root), Logo.read(root), Tokens.read(root)
])

/**
 * What `front.data.ts` yields under a build, for a case to mock it with, since
 * only VitePress runs a loader.
 */
export const data = await frontPage(bibliography, SampleDay.record(), logo, recording.results[0]!, tokens)
