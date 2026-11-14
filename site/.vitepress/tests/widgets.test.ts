import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

import { hyphenate }                from '@vueuse/core'
import { wcagContrast }             from 'culori'
import { cross, min }               from 'd3-array'
import { type Element, Window }     from 'happy-dom'
import { afterAll, expect, it, vi } from 'vitest'
import { createApp, h }             from 'vue'
import { renderToString }           from 'vue/server-renderer'

import { Sheet }                    from '../lib/bundle/sheet.ts'
import { type Scheme, Tokens }      from '../lib/theme/tokens.ts'
import { PLACEMENTS, WIDGET_NAMES } from '../lib/widgets/placements.ts'
import theme                        from '../theme/index.ts'
import { frameSheet }               from './common/frames.ts'

vi.mock('vitepress', () => ({ inBrowser: false }))
vi.mock('vitepress/theme-without-fonts', () => ({ default: { Layout: 'Layout' } }))
vi.mock('../lib/daylight/cloud-steps.data.ts', () => import('./common/data/cloud-steps.ts'))
vi.mock('../lib/daylight/day-dial.data.ts', () => import('./common/data/day-dial.ts'))
vi.mock('../lib/daylight/daylight.data.ts', () => import('./common/data/daylight.ts'))
vi.mock('../lib/daylight/factor-day.data.ts', () => import('./common/data/factor-day.ts'))
vi.mock('../lib/daylight/sun-year.data.ts', () => import('./common/data/sun-year.ts'))
vi.mock('../lib/daylight/twilight-bridge.data.ts', () => import('./common/data/twilight-bridge.ts'))
vi.mock('../lib/front/front.data.ts', () => import('./common/data/front.ts'))
vi.mock('../lib/privacy/privacy.data.ts', () => import('./common/data/privacy.ts'))
vi.mock('../lib/search/search.data.ts', () => import('./common/data/search.ts'))
vi.mock('../lib/settings/settings.data.ts', () => import('./common/data/settings.ts'))
vi.mock('../lib/troubleshooting/debug-line.data.ts', () => import('./common/data/debug-line.ts'))

/**
 * The VitePress breakpoints at which a media query may reflow a widget with
 * the page around it.
 */
const BREAKPOINTS = { lg: '60rem', md: '48rem', sm: '40rem' }
/**
 * Matches a variant moving a utility from the element carrying it to its
 * children, to every descendant, or to a child or descendant a selector names.
 */
const DESCENDANT = /(?:^|:)(?:\*\*?|\[&[_>])/
/**
 * The inks of each frame, by the class name after the frame's own name, the
 * fills being words and the strokes being marks.
 */
const FRAME_MARKS = {
  'day-estimate'    : { fills: ['caption', 'figure', 'name'], strokes: ['cover', 'edge', 'fall', 'line'] },
  'rounded-place'   : { fills: ['word'], strokes: ['cell', 'dim'] },
  'sun-path'        : { fills: ['figure', 'word'], strokes: ['curve', 'horizon'] },
  'the-gap'         : { fills: ['figure', 'word'], strokes: ['edge', 'reading'] },
  'twilight-bridge' : { fills: ['caps', 'end', 'word'], strokes: ['cut', 'drop', 'edge', 'roof'] }
}
/**
 * The schemes in the order a frame's sheet styles them, the light one first
 * and the dark one inside its media query.
 */
const SCHEMES: Scheme[] = ['light', 'dark']
const source            = await readFile(new URL('../theme/styles/tokens.css', import.meta.url), 'utf8')
const tokens            = Tokens.parse(source)
const frameInks         = Object.entries(FRAME_MARKS).flatMap(([name, { fills, strokes }]) => [
  ...fills.map((word) => ({ floor: 4.5, name, property: 'fill', selector: `.${name}-${word}` })),
  ...strokes.map((mark) => ({ floor: 3, name, property: 'stroke', selector: `.${name}-${mark}` }))
])
const frames = new Map(await Promise.all(Object.keys(FRAME_MARKS).map(async (name) =>
  [name, await frameSheet(name)] as const
)))
const registry = createApp({})
const window   = new Window()

theme.enhanceApp({ app: registry, router: {} as never, siteData: {} as never })

const widgets = new Map(await Promise.all(WIDGET_NAMES.map(async (name) => {
  const markup = await renderToString(h(registry.component(name)!))

  return [name, new window.DOMParser().parseFromString(markup, 'text/html').body] as const
})))

afterAll(() => window.happyDOM.close())

function color(name: string, scheme: Scheme): string {
  return tokens.color(`--color-${name}`, scheme)
}

function groundsOf(name: string): string[] {
  return inFrame(name, 'background', `.${name}-drawing`)
}

function inFrame(name: string, property: string, selector: string): string[] {
  const values: string[] = []

  frames.get(name)!.walkRules((rule) => {
    if (rule.selectors.includes(selector)) rule.walkDecls(property, ({ value }) => void values.push(value))
  })

  return values
}

/**
 * Finds the root of the widget `name`, the element carrying the `widget` class.
 */
function rootOf(name: string): Element {
  return widgets.get(name)!.querySelector('.widget')!
}

/**
 * Lists every utility the widget `name` renders on any of its elements.
 */
function utilitiesOf(name: string): Set<string> {
  return new Set([...widgets.get(name)!.querySelectorAll('*')].flatMap(({ classList }) => [...classList]))
}

it('declares the VitePress breakpoints a widget reflows at as the theme’s', () => {
  expect(Object.keys(BREAKPOINTS).map((size) => tokens.resolve(`--breakpoint-${size}`, 'light')))
    .toEqual(Object.values(BREAKPOINTS))
})

it('writes no color-mix() toward black, which the minifier folds into another color', () => {
  expect(new Sheet('tokens.css', source).mixes.filter((mix) => /\bblack\b/.test(mix))).toEqual([])
})

it.each(WIDGET_NAMES)('styles the root of %s itself inside no container query', (name) => {
  const root = rootOf(name)

  expect([...root.classList].filter((utility) => /(?:^|:)@/.test(utility) && !DESCENDANT.test(utility)))
    .toEqual([])
})

it.each(WIDGET_NAMES)('gives the root of %s a class named for the widget', (name) => {
  expect([...rootOf(name).classList]).toContain(hyphenate(name))
})

it.each(SCHEMES)('holds the widget’s text at 4.5:1 on each surface of the %s ground', (scheme) => {
  const inks     = ['ink', 'muted'].map((name) => color(name, scheme))
  const surfaces = ['ground', 'raised', 'sunken'].map((name) => color(name, scheme))

  expect(min(cross(inks, surfaces, wcagContrast))).toBeGreaterThanOrEqual(4.5)
})

it.each(SCHEMES)('holds the replayed field’s line at 3:1 on the %s ground', (scheme) => {
  const surfaces = ['ground', 'raised'].map((name) => color(name, scheme))

  expect(min(surfaces, (surface) => wcagContrast(color('page-line', scheme), surface)))
    .toBeGreaterThanOrEqual(3)
})

it.each(SCHEMES)('holds the color of each mark at 3:1 on the %s ground', (scheme) => {
  const marks = ['estimate', 'fallback', 'forecast', 'geometry'].map((name) => color(name, scheme))

  expect(min(marks, (mark) => wcagContrast(mark, color('ground', scheme)))).toBeGreaterThanOrEqual(3)
})

it.each(SCHEMES)('holds the ink edge of the sky at 3:1 on the sky and on the %s ground', (scheme) => {
  const surfaces = ['ground', 'sky-fill'].map((name) => color(name, scheme))

  expect(min(surfaces, (surface) => wcagContrast(color('ink', scheme), surface))).toBeGreaterThanOrEqual(3)
})

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

it.each(Object.keys(FRAME_MARKS))('draws the %s frame on the ground of each scheme', (name) => {
  expect(groundsOf(name)).toEqual(SCHEMES.map((scheme) => color('ground', scheme)))
})

it.each([
  {
    color    : 'dial-wash-0',
    name     : 'day-estimate',
    property : 'fill',
    selector : '.day-estimate-wash-0',
    widget   : 'DayEstimate'
  },
  {
    color    : 'dial-wash-1',
    name     : 'day-estimate',
    property : 'fill',
    selector : '.day-estimate-wash-1',
    widget   : 'DayEstimate'
  },
  {
    color    : 'dial-wash-2',
    name     : 'day-estimate',
    property : 'fill',
    selector : '.day-estimate-wash-2',
    widget   : 'DayEstimate'
  },
  {
    color    : 'dial-wash-3',
    name     : 'day-estimate',
    property : 'fill',
    selector : '.day-estimate-wash-3',
    widget   : 'DayEstimate'
  },
  {
    color    : 'sky-fill',
    name     : 'day-estimate',
    property : 'fill',
    selector : '.day-estimate-sky',
    widget   : 'DayEstimate'
  },
  {
    color    : 'place-cell',
    name     : 'rounded-place',
    property : 'fill',
    selector : '.rounded-place-cell',
    widget   : 'RoundedPlace'
  },
  { color: 'gap-band', name: 'the-gap', property: 'fill', selector: '.the-gap-band', widget: 'TheGap' },
  { color: 'gap-on', name: 'the-gap', property: 'fill', selector: '.the-gap-on', widget: 'TheGap' },
  {
    color    : 'bridge-line',
    name     : 'twilight-bridge',
    property : 'stroke',
    selector : '.twilight-bridge-roof',
    widget   : 'TwilightBridge'
  },
  {
    color    : 'bridge-wash',
    name     : 'twilight-bridge',
    property : 'fill',
    selector : '.twilight-bridge-wash',
    widget   : 'TwilightBridge'
  },
  {
    color    : 'sky-fill',
    name     : 'twilight-bridge',
    property : 'fill',
    selector : '.twilight-bridge-sky',
    widget   : 'TwilightBridge'
  }
])('colors $selector in the frame and in $widget as the theme mixes $color in each scheme', ({
  color: name,
  property,
  selector,
  widget,
  ...frame
}) => {
  expect(inFrame(frame.name, property, selector)).toEqual(SCHEMES.map((scheme) => color(name, scheme)))
  expect(utilitiesOf(widget)).toContain(`[&_${selector}]:${property}-${name}`)
})

it.each(SCHEMES)('holds the roof and the cut at 3:1 on the wash and on the %s ground', (scheme) => {
  const surfaces = ['ground', 'bridge-wash'].map((name) => color(name, scheme))

  expect(min(surfaces, (surface) => wcagContrast(color('bridge-line', scheme), surface)))
    .toBeGreaterThanOrEqual(3)
})

it('holds the roof and the cut in the frame at 3:1 on the wash in each scheme', () => {
  const lines  = inFrame('twilight-bridge', 'stroke', '.twilight-bridge-cut')
  const washes = inFrame('twilight-bridge', 'fill', '.twilight-bridge-wash')

  expect(min(washes, (wash, index) => wcagContrast(lines[index]!, wash))).toBeGreaterThanOrEqual(3)
})

it.each(SCHEMES)('holds the bridge’s words at 4.5:1 on the %s wash', (scheme) => {
  expect(wcagContrast(color('ink', scheme), color('bridge-wash', scheme))).toBeGreaterThanOrEqual(4.5)
})

it.each([
  { utility: 'group-[.peeked]:text-muted', widget: 'DayEstimate' },
  { utility: '[&_.day-estimate-layer:is([data-on],[data-peek])]:opacity-100', widget: 'DayEstimate' },
  {
    utility : '[&_.day-estimate-layer[data-peek]:not([data-on])_.day-estimate-bracket]:stroke-muted',
    widget  : 'DayEstimate'
  },
  { utility: '[&_.sun-path-wash]:fill-geometry', widget: 'SunPath' },
  { utility: '[&_.sun-path-wash]:[fill-opacity:0.16]', widget: 'SunPath' },
  { utility: '[&_.sun-path-hair]:stroke-sun-hair', widget: 'SunPath' },
  { utility: '[&_.sun-path-month]:[stroke-dasharray:2_3]', widget: 'SunPath' },
  { utility: '[&.year_.sun-path-curve]:stroke-[3.4]', widget: 'SunPath' },
  { utility: '[&_.twilight-bridge-cut]:stroke-bridge-line', widget: 'TwilightBridge' }
])('styles $widget with $utility', ({ utility, widget }) => {
  expect(utilitiesOf(widget)).toContain(utility)
})

it('holds the request clock’s later marks back until the failing hour', () => {
  const later = [...widgets.get('RequestClock')!.querySelectorAll('.later')]

  expect(later.length).toBeGreaterThan(0)
  expect(later.filter(({ classList }) =>
    !classList.contains('opacity-0') || !classList.contains('group-data-[on=fails]:opacity-100')
  )).toEqual([])
})
