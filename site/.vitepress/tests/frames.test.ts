import { readFile }      from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { Window }                               from 'happy-dom'
import { expect, it }                           from 'vitest'
import { type VNode, cloneVNode, createSSRApp } from 'vue'
import { renderToString }                       from 'vue/server-renderer'

import { dayDial }                  from '../lib/daylight/day-dial.ts'
import * as dialLens                from '../lib/daylight/dial-lens.ts'
import { SampleDay }                from '../lib/daylight/sample-day.ts'
import { SUNSET_WORD, SUN_LAYOUTS } from '../lib/daylight/sun-curve.ts'
import { sunYear }                  from '../lib/daylight/sun-year.ts'
import { twilightBridge }           from '../lib/daylight/twilight-bridge.ts'
import { roundedPlace }             from '../lib/privacy/rounded-place.ts'
import { PLACEMENTS }               from '../lib/widgets/placements.ts'
import { bridgeDrawing }            from '../theme/components/daylight/bridge-drawing.ts'
import { dialDrawing }              from '../theme/components/daylight/dial-drawing.ts'
import { gapDrawing }               from '../theme/components/daylight/gap-drawing.ts'
import { sunDrawing }               from '../theme/components/daylight/sun-drawing.ts'
import { placeDrawing }             from '../theme/components/privacy/place-drawing.ts'
import { plotDrawing }              from '../theme/controls/plot-marks.ts'
import { data }                     from './common/data/daylight.ts'
import { frameSheet }               from './common/frames.ts'
import { framed }                   from './common/outline.ts'

const day     = SampleDay.record()
const { gap } = data
const placed  = PLACEMENTS.filter(({ frame }) => frame)
const site    = join(import.meta.dirname, '..', '..')
const bridge  = twilightBridge(day.sky)
const dial    = dayDial(day)
const year    = sunYear(day)

/**
 * Writes a drawing's markup with the sheet that styles it outside the site, and
 * with the words the widget sets around it in HTML, every word an outline.
 */
async function frameOf(drawing: VNode, name: string, words = ''): Promise<string> {
  const markup = await renderToString(createSSRApp({ render: () => drawing }))

  return framed(markup.replace(/<\/svg>$/, `${words}</svg>`), await frameSheet(name))
}

/**
 * Writes one of a frame's words inside its SVG, with the class naming `widget`.
 */
function frameWord(widget: string) {
  return (name: string, x: number, y: number, words: string, anchor = 'middle') =>
    `<text class="${widget}-${name}" text-anchor="${anchor}" x="${x}" y="${y}">${words}</text>`
}

it('commits the frame the gap opens on, as the widget draws it', async () => {
  const layout = gap.layouts.at(-1)!

  await expect(await frameOf(gapDrawing(layout, gap), 'the-gap'))
    .toMatchFileSnapshot(join(site, 'sensors', 'the-gap.svg'))
})

it('commits the frame The Sun’s Path opens on, as the widget draws it', async () => {
  await expect(await frameOf(sunDrawing(SUN_LAYOUTS[1], year, 'sun-path-glow'), 'sun-path'))
    .toMatchFileSnapshot(join(site, 'estimate', 'sun-path.svg'))
})

it('commits the frame The Day’s Estimate opens on, with its names and its figure', async () => {
  const { center, height, width } = dialLens.DIAL

  const plot    = new dialLens.DialPlot(dial.marks)
  const paths   = dialLens.HALVES.map((half) => plot.paths(half, plot.twilight(half) === dial.opens ? 1 : 0))
  const opening = dial.stretches[dial.opens]!
  const text    = frameWord('day-estimate')
  const names   = dial.stretches.map(({ name, place }) =>
    text('name', place.left * width / 100, place.top * height / 100, name)
  )
  const words = [
    ...names,
    text('figure', center.x, center.y, opening.figure),
    text('caption', center.x, center.y + 16, opening.caption)
  ]

  await expect(await frameOf(dialDrawing(dial, paths, dial.opens), 'day-estimate', words.join('')))
    .toMatchFileSnapshot(join(site, 'estimate', 'day-estimate.svg'))
})

it('commits the frame The Twilight Bridge opens on, with its words', async () => {
  const { decades, height, high, label, low, rest, ticks, width, x, y } = bridge

  const plot   = { height, width, x: 64, y: 20 }
  const text   = frameWord('twilight-bridge')
  const across = (at: number) => plot.x + at
  const up     = (at: number) => plot.y + at
  const dot    = (name: string, at: number, level: number, r: number) =>
    `<circle class="twilight-bridge-${name}" cx="${across(at)}" cy="${up(level)}" r="${r}"></circle>`
  const words = [
    ...[{ at: 0, word: 'lux' }, ...decades].map(({ at, word }) =>
      text('word', plot.x - 6, up(at), word, 'end')
    ),
    ...ticks.map(({ at, word }) => text('word', across(at), up(height) + 16, word)),
    text('caps', plot.x + 6, up(14), 'THE BRIDGE', 'start'),
    dot('node', low.x, low.y, 3),
    dot('node', high.x, high.y, 3),
    text('end', plot.x - 10, up(low.y), low.word, 'end'),
    text('end', across(high.x) - 8, up(high.y) - 12, high.word, 'end'),
    dot('sun', x[rest]!, y[rest]!, 7)
  ]
  const drawing = plotDrawing(
    'twilight-bridge-drawing',
    label,
    plot.x + width + 16,
    plot.y + height + 28,
    [cloneVNode(bridgeDrawing(bridge), plot)]
  )

  await expect(await frameOf(drawing, 'twilight-bridge', words.join('')))
    .toMatchFileSnapshot(join(site, 'estimate', 'twilight-bridge.svg'))
})

it('commits the frame The Rounded Place opens on, as the widget draws it', async () => {
  await expect(await frameOf(placeDrawing(roundedPlace(day.window.place)), 'rounded-place'))
    .toMatchFileSnapshot(join(site, 'privacy', 'rounded-place.svg'))
})

it('describes the bridge’s frame on estimate/clear-sky.md through the figures it draws', async () => {
  const { high, low, ticks } = bridge

  const page = await readFile(join(site, 'estimate', 'clear-sky.md'), 'utf8')

  expect(page).toContain(
    `from ${ticks[0]!.word} to ${ticks.at(-1)!.word} on a logarithmic lux scale, climbing from ${low.word} `
    + `to ${high.word} across the washed span up to ${SUNSET_WORD} and through that cutoff`
  )
})

it.each(placed)('writes the frame $widget opens on as well-formed XML', async ({ frame, page }) => {
  const text   = await readFile(join(site, dirname(page), frame!), 'utf8')
  const parsed = new (new Window().DOMParser)().parseFromString(text, 'image/svg+xml')

  expect(parsed.querySelector('parsererror')).toBeNull()
  expect(parsed.documentElement.localName).toBe('svg')
})

it.each(placed)('sets no word of the frame $widget opens on in a reader’s font', async ({ frame, page }) => {
  const text = await readFile(join(site, dirname(page), frame!), 'utf8')

  expect(text).not.toMatch(/<text\b|font-family|font-size/)
})
