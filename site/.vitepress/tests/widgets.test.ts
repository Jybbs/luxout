import { glob, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

import { formatHex, interpolate, wcagContrast }    from 'culori'
import { cross, min }                              from 'd3-array'
import postcss, { type ChildNode, type Container } from 'postcss'
import { expect, it }                              from 'vitest'

import { type Scheme, Tokens }      from '../lib/theme/tokens.ts'
import { PLACEMENTS, WIDGET_NAMES } from '../lib/widgets/placements.ts'
import { frameSheet }               from './common/frames.ts'

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
  { bridge: '.twilight-bridge', scheme: 'light', widget: '.widget' },
  { bridge: '.dark .twilight-bridge', scheme: 'dark', widget: '.dark .widget' }
] as const
/**
 * The widths a media query may name, each one of VitePress's own breakpoints.
 */
const MEDIA_WIDTHS = new Set(['40rem', '48rem', '60rem'])
const theme        = join(import.meta.dirname, '..', 'theme')
const frameInks    = Object.entries(FRAME_MARKS).flatMap(([name, { fills, strokes }]) => [
  ...fills.map((word) => ({ floor: 4.5, name, property: 'fill', selector: `.${name}-${word}` })),
  ...strokes.map((mark) => ({ floor: 3, name, property: 'stroke', selector: `.${name}-${mark}` }))
])
const frames = new Map(await Promise.all(Object.keys(FRAME_MARKS).map(async (name) =>
  [name, await frameSheet(name)] as const
)))
const tokens = await Tokens.read(new URL('../', import.meta.url))
const paths  = await Array.fromAsync(glob('**/*.css', { cwd: theme }))
const texts  = await Promise.all(paths.map((path) => readFile(join(theme, path), 'utf8')))
const sheet  = postcss.parse(texts.join('\n'))

function declared(root: Container, property: string, selector: string): string[] {
  return descendants(root).flatMap((rule) => rule.type === 'rule' && rule.selectors.includes(selector)
    ? descendants(rule).flatMap((node) => node.type === 'decl' && node.prop === property ? [node.value] : [])
    : [])
}

/**
 * Lists every node beneath `root`, in the order the stylesheet sets them.
 */
function descendants(root: Container): ChildNode[] {
  const nodes: ChildNode[] = []

  root.walk((node) => {
    nodes.push(node)
  })

  return nodes
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

/**
 * Writes the widget `name` in kebab case as a class selector.
 */
function rootSelector(name: string): string {
  return `.${name.replaceAll(/\B[A-Z]/g, '-$&').toLowerCase()}`
}

function token(name: string, scheme: Scheme): string {
  return tokens.follow(declared(sheet, name, '.widget')[0]!, scheme)
}

function washOf(bridge: string, scheme: Scheme): string {
  return mixed(token('--widget-ground', scheme), token('--widget-geometry', scheme), '--bridge-wash', bridge)
}

function widths(name: 'container' | 'media'): Set<string> {
  return new Set(descendants(sheet).flatMap((node) => node.type === 'atrule' && node.name === name
    ? /width\D*([\d.]+\w+)/.exec(node.params)?.slice(1) ?? []
    : []))
}

it('names each container query at a width from the one declared set', () => {
  expect(widths('container').difference(CONTAINER_WIDTHS)).toEqual(new Set())
})

it('names each media query at a width from VitePress’s breakpoints', () => {
  expect(widths('media').difference(MEDIA_WIDTHS)).toEqual(new Set())
})

it('styles no widget’s root inside a container query, which reads the width of an ancestor', () => {
  const roots   = new Set(WIDGET_NAMES.map(rootSelector))
  const queried = descendants(sheet)
    .flatMap((node) => node.type === 'atrule' && node.name === 'container' ? descendants(node) : [])

  expect(queried.flatMap((node) => node.type === 'rule' && roots.has(node.selector) ? [node.selector] : []))
    .toEqual([])
})

it('names the root of each widget the sheet styles, the day estimate styling `.widget` alone', () => {
  const styled = new Set(descendants(sheet).flatMap((node) => node.type === 'rule' ? node.selectors : []))

  expect(new Set(WIDGET_NAMES.map(rootSelector)).difference(styled)).toEqual(new Set(['.day-estimate']))
})

it('writes no color-mix toward black, which the minifier folds into another color', () => {
  expect(descendants(sheet).flatMap((node) =>
    node.type === 'decl' && /color-mix\([^)]*\bblack\b/.test(node.value) ? [node.value] : []
  )).toEqual([])
})

it.each(GROUNDS)('holds the widget’s text at 4.5:1 on each surface of the $scheme ground', ({ scheme }) => {
  const color    = (name: string) => token(name, scheme)
  const inks     = ['--widget-ink', '--widget-muted'].map(color)
  const surfaces = ['--widget-ground', '--widget-raised', '--widget-sunken'].map(color)

  expect(min(cross(inks, surfaces, wcagContrast))).toBeGreaterThanOrEqual(4.5)
})

it.each(GROUNDS)('holds the replayed field’s line at 3:1 on the $scheme ground', ({ scheme }) => {
  const color = (name: string) => token(name, scheme)
  const line  = mixed(color('--widget-raised'), color('--widget-muted'), '--page-line', '.location-search')
  const edges = cross([line], ['--widget-ground', '--widget-raised'].map(color), wcagContrast)

  expect(min(edges)).toBeGreaterThanOrEqual(3)
})

it.each(GROUNDS)('holds the color of each mark at 3:1 on the $scheme ground', ({ scheme }) => {
  const ground = token('--widget-ground', scheme)
  const marks  = ['--widget-estimate', '--widget-fallback', '--widget-forecast', '--widget-geometry']
    .map((name) => token(name, scheme))

  expect(min(marks, (mark) => wcagContrast(mark, ground))).toBeGreaterThanOrEqual(3)
})

it.each(GROUNDS)(
  'holds the ink edge of the sky at 3:1 on the sky and on the $scheme ground',
  ({ scheme, widget }) => {
    const ground = token('--widget-ground', scheme)
    const sky    = mixed(ground, token('--widget-sky', scheme), '--widget-sky-fill', widget)

    expect(min([ground, sky], (surface) => wcagContrast(token('--widget-ink', scheme), surface)))
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
  const tints = groundsOf(name).map((ground, index) =>
    mixed(ground, token(color, GROUNDS[index]!.scheme), 'fill', selector)
  )

  expect(inFrame(name, 'fill', selector)).toEqual(tints)
})

it.each([
  { name: 'day-estimate', selector: '.day-estimate-sky' },
  { name: 'twilight-bridge', selector: '.twilight-bridge-sky' }
])('fills $selector in the frame as the sheet mixes it in each scheme', ({ name, selector }) => {
  const tints = groundsOf(name).map((ground, index) => {
    const { scheme, widget } = GROUNDS[index]!

    return mixed(ground, token('--widget-sky', scheme), '--widget-sky-fill', widget)
  })

  expect(inFrame(name, 'fill', selector)).toEqual(tints)
})

it('tints the bridge in the frame as the sheet mixes its wash and its line in each scheme', () => {
  const inks   = inFrame('twilight-bridge', 'stroke', '.twilight-bridge-edge')
  const ubes   = GROUNDS.map(({ scheme }) => token('--widget-geometry', scheme))
  const washes = groundsOf('twilight-bridge').map((ground, index) =>
    mixed(ground, ubes[index]!, '--bridge-wash', GROUNDS[index]!.bridge)
  )

  expect(inFrame('twilight-bridge', 'fill', '.twilight-bridge-wash')).toEqual(washes)
  expect(inFrame('twilight-bridge', 'stroke', '.twilight-bridge-roof')).toEqual(inks.map((ink, index) =>
    mixed(ink, ubes[index]!, '--bridge-line', '.twilight-bridge')
  ))
})

it.each(GROUNDS)(
  'holds the roof and the cut at 3:1 on the wash and on the $scheme ground',
  ({ bridge, scheme }) => {
    const ground = token('--widget-ground', scheme)
    const ube    = token('--widget-geometry', scheme)
    const line   = mixed(token('--widget-ink', scheme), ube, '--bridge-line', '.twilight-bridge')

    expect(min([ground, washOf(bridge, scheme)], (surface) => wcagContrast(line, surface)))
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

it.each(GROUNDS)('holds the bridge’s words at 4.5:1 on the $scheme wash', ({ bridge, scheme }) => {
  expect(wcagContrast(token('--widget-ink', scheme), washOf(bridge, scheme))).toBeGreaterThanOrEqual(4.5)
})

it.each([
  {
    property : 'color',
    selector : '.day-estimate-hub.peeked .day-estimate-figure',
    value    : 'var(--widget-muted)'
  },
  { property: 'opacity', selector: '.day-estimate-layer[data-peek]', value: '1' },
  {
    property : 'stroke',
    selector : '.day-estimate-layer[data-peek]:not([data-on]) .day-estimate-bracket',
    value    : 'var(--widget-muted)'
  },
  { property: 'fill', selector: '.sun-path-wash', value: 'var(--widget-geometry)' },
  { property: 'fill-opacity', selector: '.sun-path-wash', value: '0.16' },
  {
    property : 'stroke',
    selector : '.sun-path-hair',
    value    : 'color-mix(in oklab, var(--widget-muted) 80%, var(--widget-ground))'
  },
  { property: 'stroke-dasharray', selector: '.sun-path-month', value: '2 3' },
  { property: 'stroke-width', selector: '.sun-path.year .sun-path-curve', value: '3.4' }
])('declares $property on $selector as $value', ({ property, selector, value }) => {
  expect(declared(sheet, property, selector)).toEqual([value])
})
