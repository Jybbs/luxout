import { readFile } from 'node:fs/promises'

import { type Root, parse } from 'postcss'

import { FONT_FILES, Typeface } from '../../lib/type/typeface.ts'

const ATTRIBUTE = /([\w-]+)="([^"]*)"/g
const DEFAULT   = 16  // The pixels to the em of a word no rule or attribute sizes
/**
 * Lists the properties that style a word, none of which an outlined word reads.
 */
const SETTINGS = new Set([
  'dominant-baseline',
  'font-size',
  'font-weight',
  'letter-spacing',
  'text-transform'
])
const TEXT     = /<text ([^>]*)>([^<]*)<\/text>/g
const typeface = new Typeface(await readFile(new URL(`../../${FONT_FILES.mono}`, import.meta.url)))

/**
 * Reads the declarations the top-level rules of `root` give the class `name`,
 * the later rule winning, which leaves out every rule nested in a media query.
 */
function settingsOf(root: Root, name: string): Map<string, string> {
  return new Map(root.nodes.flatMap((node) =>
      node.type === 'rule' && node.selectors.includes(`.${name}`)
    ? node.nodes.filter((child) => child.type === 'decl').map(({ prop, value }) => [prop, value] as const)
    : []
  ))
}

/**
 * Removes every declaration that styles a word from `root`, along with each
 * rule that leaves empty.
 */
function stripped(root: Root): string {
  root.walkDecls((declaration) => {
    if (SETTINGS.has(declaration.prop)) declaration.remove()
  })
  root.walkRules((rule) => {
    if (rule.nodes.length === 0) rule.remove()
  })

  return root.toString()
}

/**
 * Sets each `<text>` in `markup` in JetBrains Mono as an outline, at the size,
 * the weight, the spacing, and the case `css` gives its class, and appends
 * `css` without those declarations, so the frame depends on no font a reader's
 * machine holds.
 */
export function framed(markup: string, css: string): string {
  const root = parse(css)
  const body = markup.replace(TEXT, (_, attributes: string, word: string) => {
    const given    = new Map(attributes.matchAll(ATTRIBUTE).map(([, key, value]) => [key!, value!]))
    const name     = given.get('class')!
    const settings = settingsOf(root, name)
    const size     = Number.parseFloat(settings.get('font-size') ?? given.get('font-size') ?? `${DEFAULT}`)
    const axes     = { wght: Number(settings.get('font-weight') ?? 400) }
    const track    = Number.parseFloat(settings.get('letter-spacing') ?? '0') * size
    const raised   = settings.get('text-transform') === 'uppercase' ? word.toUpperCase() : word
    const setting  = typeface.set(raised, { axes, size, track })
    const shift    = { end: setting.width, middle: setting.width / 2 }[given.get('text-anchor') ?? ''] ?? 0
    const central  = settings.has('dominant-baseline') || given.has('dominant-baseline')
                   ? typeface.set('H', { axes, size }).ink.top / 2
                   : 0
    const place = setting.transformAt(Number(given.get('x')) - shift, Number(given.get('y')) + central)

    return `<path class="${name}" d="${setting.d}" transform="${place}"></path>`
  })

  return `${body.replace(/<\/svg>$/, `<style>${stripped(root)}</style></svg>`)}\n`
}
