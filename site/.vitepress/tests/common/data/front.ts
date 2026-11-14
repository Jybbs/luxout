import { pathToFileURL } from 'node:url'

import { Bibliography } from '../../../lib/citations/bibliography.ts'
import { SampleDay }    from '../../../lib/daylight/sample-day.ts'
import { frontPage }    from '../../../lib/front/front.ts'
import { Logo }         from '../../../lib/logo/logo.ts'
import recording        from '../../../lib/search/recording.json' with { type: 'json' }
import { Tokens }       from '../../../lib/theme/tokens.ts'

const root                         = pathToFileURL(`${import.meta.dirname}/../../../`)
const [bibliography, logo, tokens] = await Promise.all([
  Bibliography.read(root), Logo.read(root), Tokens.read(root)
])

/**
 * What `front.data.ts` yields under a build, for a case to mock it with, since
 * only VitePress runs a loader.
 */
export const data = await frontPage(bibliography, SampleDay.record(), logo, recording.results[0]!, tokens)
