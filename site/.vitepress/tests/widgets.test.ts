import { glob, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

import { formatHex, interpolate, wcagContrast } from 'culori'
import { cross, min }                           from 'd3-array'
import postcss, { type Root }                   from 'postcss'
import { expect, it }                           from 'vitest'

import { PLACEMENTS, WIDGET_NAMES } from '../lib/widgets/placements.ts'

/**
 * The widths a container query may name, each where a widget reflows inside its
 * column.
 */
const CONTAINER_WIDTHS = new Set(['30rem', '38rem'])
/**
 * The inks of each frame, by the class name after the frame's own name, the
 * fills being words and the strokes being marks.
 */
const FRAME_MARKS = {
  'day-estimate'    : { fills: ['caption', 'figure', 'name'], strokes: ['cover', 'edge', 'fall', 'line'] },
  'sun-path'        : { fills: ['figure', 'word'], strokes: ['curve', 'horizon'] },
  'the-gap'         : { fills: ['figure', 'word'], strokes: ['edge', 'reading'] },
  'twilight-bridge' : { fills: ['caps', 'end', 'word'], strokes: ['cut', 'drop', 'edge', 'roof'] }
}
const GROUNDS = [
  { bridge: '.twilight-bridge', name: 'light', selector: ':root', widget: '.widget' },
  { bridge: '.dark .twilight-bridge', name: 'dark', selector: '.dark', widget: '.dark .widget' }
]
/**
 * The widths a media query may name, each one of VitePress's own breakpoints.
 */
const MEDIA_WIDTHS = new Set(['40rem', '48rem', '60rem'])
const theme        = join(import.meta.dirname, '..', 'theme')
const vars         = new URL(import.meta.resolve('vitepress/dist/client/theme-default/styles/vars.css'))
const frameInks    = Object.entries(FRAME_MARKS).flatMap(([name, { fills, strokes }]) => [
  ...fills.map((word) => ({ floor: 4.5, name, property: 'fill', selector: `.${name}-${word}` })),
  ...strokes.map((mark) => ({ floor: 3, name, property: 'stroke', selector: `.${name}-${mark}` }))
])
const frames = new Map(await Promise.all(Object.keys(FRAME_MARKS).map(async (name) => {
  const framing = new URL(`../lib/daylight/${name}-frame.css`, import.meta.url)

  return [name, postcss.parse(await readFile(framing, 'utf8'))] as const
})))
const palette = postcss.parse(await readFile(vars, 'utf8'))
const paths   = await Array.fromAsync(glob('**/*.css', { cwd: theme }))
const texts   = await Promise.all(paths.map((path) => readFile(join(theme, path), 'utf8')))
const sheet   = postcss.parse(texts.join('\n'))
const ube     = fallback('--widget-geometry')

function declared(root: Root, property: string, selector: string): string[] {
  const values: string[] = []

  root.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return

    rule.walkDecls(property, ({ value }) => {
      values.push(value)
    })
  })

  return values
}

function fallback(name: string): string {
  return /#\w+/.exec(declared(sheet, name, '.widget')[0]!)![0]
}

function groundsOf(name: string): string[] {
  return inFrame(name, 'background', `.${name}-drawing`)
}

function inFrame(name: string, property: string, selector: string): string[] {
  return declared(frames.get(name)!, property, selector)
}

function mixed(ground: string, ink: string, property: string, selector: string): string {
  const [mix] = declared(sheet, property, selector)

  return formatHex(interpolate([ground, ink], 'rgb')(Number(/([\d.]+)%/.exec(mix!)![1]) / 100))
}

function resolved(name: string, selector: string): string {
  const value = declared(palette, name, selector).at(-1) ?? ''
  const chain = /^var\((--[\w-]+)\)$/.exec(value)

  return chain ? resolved(chain[1]!, selector) : value
}

function token(name: string, selector: string): string {
  return resolved(/--vp[\w-]+/.exec(declared(sheet, name, '.widget')[0]!)![0], selector)
}

function washOf(bridge: string, selector: string): string {
  return mixed(token('--widget-ground', selector), ube, '--bridge-wash', bridge)
}

function widths(name: 'container' | 'media'): Set<string> {
  const found = new Set<string>()

  sheet.walkAtRules(name, ({ params }) => {
    const [, width] = /width\D*([\d.]+\w+)/.exec(params) ?? []

    if (width) found.add(width)
  })

  return found
}

it('names each container query at a width from the one declared set', () => {
  expect(widths('container').difference(CONTAINER_WIDTHS)).toEqual(new Set())
})

it('names each media query at a width from VitePress’s breakpoints', () => {
  expect(widths('media').difference(MEDIA_WIDTHS)).toEqual(new Set())
})

it('styles no widget’s root inside a container query, which reads the width of an ancestor', () => {
  const roots = new Set(WIDGET_NAMES.map((name) => `.${name.replaceAll(/\B[A-Z]/g, '-$&').toLowerCase()}`))
  const found: string[] = []

  sheet.walkAtRules('container', (query) => {
    query.walkRules(({ selector }) => {
      if (roots.has(selector)) found.push(selector)
    })
  })

  expect(found).toEqual([])
})

it('writes no color-mix toward black, which the minifier folds into another color', () => {
  const found: string[] = []

  sheet.walkDecls(({ value }) => {
    if (/color-mix\([^)]*\bblack\b/.test(value)) found.push(value)
  })

  expect(found).toEqual([])
})

it.each(GROUNDS)('holds the widget’s text at 4.5:1 on each surface of the $name ground', ({ selector }) => {
  const color    = (name: string) => token(name, selector)
  const inks     = ['--widget-ink', '--widget-muted'].map(color)
  const surfaces = ['--widget-ground', '--widget-raised', '--widget-sunken'].map(color)

  expect(min(cross(inks, surfaces, wcagContrast))).toBeGreaterThanOrEqual(4.5)
})

it.each(GROUNDS)('holds the replayed field’s line at 3:1 on the $name ground', ({ selector }) => {
  const color = (name: string) => token(name, selector)
  const line  = mixed(color('--widget-raised'), color('--widget-muted'), '--page-line', '.location-search')
  const edges = cross([line], ['--widget-ground', '--widget-raised'].map(color), wcagContrast)

  expect(min(edges)).toBeGreaterThanOrEqual(3)
})

it.each(GROUNDS)('holds the color of each mark at 3:1 on the $name ground', ({ selector }) => {
  const ground = token('--widget-ground', selector)
  const marks  = ['--widget-estimate', '--widget-fallback', '--widget-forecast', '--widget-geometry']
    .map(fallback)

  expect(min(marks, (mark) => wcagContrast(mark, ground))).toBeGreaterThanOrEqual(3)
})

it.each(GROUNDS)(
  'holds the ink edge of the sky at 3:1 on the sky and on the $name ground',
  ({ selector, widget }) => {
    const ground = token('--widget-ground', selector)
    const sky    = mixed(ground, fallback('--widget-sky'), '--widget-sky-fill', widget)

    expect(min([ground, sky], (surface) => wcagContrast(token('--widget-ink', selector), surface)))
      .toBeGreaterThanOrEqual(3)
  }
)

it('holds the inks of each frame a placement opens on', () => {
  const framed = PLACEMENTS.flatMap(({ frame }) => frame ? [basename(frame, '.svg')] : [])

  expect(Object.keys(FRAME_MARKS).toSorted()).toEqual(framed.toSorted())
})

it.each(frameInks)('holds $selector in the frame at $floor:1 on each ground', ({
  floor,
  name,
  property,
  selector
}) => {
  const inks  = inFrame(name, property, selector)
  const worst = min(groundsOf(name), (ground, index) => wcagContrast(inks[index] ?? inks[0]!, ground))

  expect(worst).toBeGreaterThanOrEqual(floor)
})

it.each([
  { color: '--widget-geometry', name: 'day-estimate', selector: '.day-estimate-wash-0' },
  { color: '--widget-geometry', name: 'day-estimate', selector: '.day-estimate-wash-1' },
  { color: '--widget-geometry', name: 'day-estimate', selector: '.day-estimate-wash-2' },
  { color: '--widget-geometry', name: 'day-estimate', selector: '.day-estimate-wash-3' },
  { color: '--widget-sensor', name: 'the-gap', selector: '.the-gap-band' },
  { color: '--widget-sensor', name: 'the-gap', selector: '.the-gap-on' }
])('tints $selector in the frame as the sheet mixes it', ({ color, name, selector }) => {
  const tints = groundsOf(name).map((ground) => mixed(ground, fallback(color), 'fill', selector))

  expect(inFrame(name, 'fill', selector)).toEqual(tints)
})

it.each([
  { name: 'day-estimate', selector: '.day-estimate-sky' },
  { name: 'twilight-bridge', selector: '.twilight-bridge-sky' }
])('fills $selector in the frame as the sheet mixes it in each scheme', ({ name, selector }) => {
  const tints = groundsOf(name).map((ground, index) =>
    mixed(ground, fallback('--widget-sky'), '--widget-sky-fill', GROUNDS[index]!.widget)
  )

  expect(inFrame(name, 'fill', selector)).toEqual(tints)
})

it('tints the bridge in the frame as the sheet mixes its wash and its line in each scheme', () => {
  const inks   = inFrame('twilight-bridge', 'stroke', '.twilight-bridge-edge')
  const washes = groundsOf('twilight-bridge').map((ground, index) =>
    mixed(ground, ube, '--bridge-wash', GROUNDS[index]!.bridge)
  )

  expect(inFrame('twilight-bridge', 'fill', '.twilight-bridge-wash')).toEqual(washes)
  expect(inFrame('twilight-bridge', 'stroke', '.twilight-bridge-roof')).toEqual(inks.map((ink) =>
    mixed(ink, ube, '--bridge-line', '.twilight-bridge')
  ))
})

it.each(GROUNDS)(
  'holds the roof and the cut at 3:1 on the wash and on the $name ground',
  ({ bridge, selector }) => {
    const ground = token('--widget-ground', selector)
    const line   = mixed(token('--widget-ink', selector), ube, '--bridge-line', '.twilight-bridge')

    expect(min([ground, washOf(bridge, selector)], (surface) => wcagContrast(line, surface)))
      .toBeGreaterThanOrEqual(3)
  }
)

it.each(['.twilight-bridge-cut', '.twilight-bridge-roof'])('strokes %s in the bridge’s line', (selector) => {
  expect(declared(sheet, 'stroke', selector)).toEqual(['var(--bridge-line)'])
})

it('holds the roof and the cut in the frame at 3:1 on the wash in each scheme', () => {
  const lines  = inFrame('twilight-bridge', 'stroke', '.twilight-bridge-cut')
  const washes = inFrame('twilight-bridge', 'fill', '.twilight-bridge-wash')

  expect(min(washes, (wash, index) => wcagContrast(lines[index]!, wash))).toBeGreaterThanOrEqual(3)
})

it.each(GROUNDS)('holds the bridge’s words at 4.5:1 on the $name wash', ({ bridge, selector }) => {
  expect(wcagContrast(token('--widget-ink', selector), washOf(bridge, selector))).toBeGreaterThanOrEqual(4.5)
})
