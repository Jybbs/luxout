import { blend, wcagContrast }  from 'culori'
import { describe, expect, it } from 'vitest'

import { SCHEMES, type Scheme, Tokens } from '../../../lib/theme/tokens.ts'

/**
 * A text color the theme sets, beside the ground it sits on and each
 * translucent tint laid over that ground beneath it.
 */
interface Pair {
  ground : string
  scheme : Scheme
  text   : string
  tints  : readonly string[]
}

const GROUNDS = ['--vp-c-bg', '--vp-c-bg-alt', '--vp-c-bg-elv', '--vp-c-bg-soft']
const STATES  = ['caution', 'danger', 'important', 'note', 'success', 'tip', 'warning']
const TEXTS   = ['--vp-c-brand-1', '--vp-c-text-1', '--vp-c-text-2', '--vp-c-text-3']

/**
 * The contrast WCAG 2.2 sets for body text under Success Criterion 1.4.3.
 */
const WCAG_AA = 4.5

const tokens = await Tokens.read(new URL('../../../', import.meta.url))

const pairs: Pair[] = SCHEMES.flatMap((scheme) => [
  ...GROUNDS.flatMap((ground) => TEXTS.map((text) => ({ ground, scheme, text, tints: [] }))),
  ...GROUNDS.map((ground) => ({ ground, scheme, text: '--vp-c-brand-1', tints: ['--vp-code-bg'] })),
  ...STATES.flatMap((state) => ['1', '2'].flatMap((level) => [1, 2].map((count) => ({
    ground : '--vp-c-bg',
    scheme : scheme,
    text   : `--vp-c-${state}-${level}`,
    tints  : Array<string>(count).fill(`--vp-c-${state}-soft`)
  })))),
  { ground: '--vp-c-brand-1', scheme, text: '--vp-button-brand-active-text', tints: [] },
  { ground: '--vp-c-brand-2', scheme, text: '--vp-button-brand-hover-text', tints: [] },
  { ground: '--vp-c-brand-3', scheme, text: '--vp-button-brand-text', tints: [] }
])

describe('every text color the theme sets', () => {
  it.for(pairs)(
    'holds AA as $text on $ground under $tints in the $scheme scheme',
    ({ ground, scheme, text, tints }) => {
      const color = (token: string) => tokens.resolve(token, scheme)

      expect(wcagContrast(color(text), blend([color(ground), ...tints.map(color)])))
        .toBeGreaterThanOrEqual(WCAG_AA)
    }
  )
})
