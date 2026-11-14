import { pathToFileURL } from 'node:url'

import { SampleDay } from '../../../lib/daylight/sample-day.ts'
import { frontPage } from '../../../lib/front/front.ts'
import { Logo }      from '../../../lib/logo/logo.ts'
import recording     from '../../../lib/search/recording.json' with { type: 'json' }
import { Tokens }    from '../../../lib/theme/tokens.ts'

const root           = pathToFileURL(`${import.meta.dirname}/../../../`)
const [logo, tokens] = await Promise.all([Logo.read(root), Tokens.read(root)])

/**
 * What `front.data.ts` yields under a build, for a case to mock it with, since
 * only VitePress runs a loader.
 */
export const data = await frontPage(SampleDay.record(), logo, recording.results[0]!, tokens)
