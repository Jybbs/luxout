import { defineLoader } from 'vitepress'

import { Bibliography }              from '../citations/bibliography.ts'
import { SampleDay }                 from '../daylight/sample-day.ts'
import { Logo }                      from '../logo/logo.ts'
import recording                     from '../search/recording.json' with { type: 'json' }
import { Tokens }                    from '../theme/tokens.ts'
import { type FrontPage, frontPage } from './front.ts'

declare const data: FrontPage

export { data }

export default defineLoader({
  async load(): Promise<FrontPage> {
    const root                         = new URL('../../', import.meta.url)
    const [bibliography, logo, tokens] = await Promise.all([
      Bibliography.read(root), Logo.read(root), Tokens.read(root)
    ])

    return frontPage(bibliography, SampleDay.record(), logo, recording.results[0]!, tokens)
  }
})
