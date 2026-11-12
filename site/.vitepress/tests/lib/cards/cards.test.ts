import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir }                from 'node:os'
import { join }                  from 'node:path'

import { wcagContrast }             from 'culori'
import { range }                    from 'd3-array'
import { decode }                   from 'fast-png'
import { test as base, expect, vi } from 'vitest'

import { Faces }                   from '../../../lib/cards/faces.ts'
import { hillCard }                from '../../../lib/cards/hill.ts'
import { readPalette }             from '../../../lib/cards/palette.ts'
import { renderCards }             from '../../../lib/cards/render.ts'
import { seeded }                  from '../../../lib/cards/seeded.ts'
import { HOURS, sectionCard }      from '../../../lib/cards/section.ts'
import * as sky                    from '../../../lib/cards/sky.ts'
import { pageTitle, sectionPages } from '../../../lib/config/pages.ts'
import { SECTIONS }                from '../../../lib/config/sections.ts'
import { luxRange }                from '../../../lib/daylight/homekit.ts'
import { SampleDay }               from '../../../lib/daylight/sample-day.ts'
import { Logo }                    from '../../../lib/logo/logo.ts'
import { FONT_FILES, Typeface }    from '../../../lib/type/typeface.ts'

vi.setConfig({ testTimeout: 60_000 })

const test = base.extend('outDir', async ({ onTestFinished }) => {
  const outDir = await mkdtemp(join(tmpdir(), 'luxout-cards-'))

  onTestFinished(() => rm(outDir, { force: true, recursive: true }))

  return outDir
})

const root    = new URL('../../../', import.meta.url)
const day     = SampleDay.record()
const faces   = await Faces.read(root)
const logo    = await Logo.read(root)
const palette = await readPalette(root)
const site    = join(import.meta.dirname, '..', '..', '..', '..')
const titles  = SECTIONS.flatMap((section) => [
  pageTitle(join(site, section.slug, 'index.md')),
  ...sectionPages(site, section).map(({ text }) => text)
])
const bodoni  = new Typeface(await readFile(new URL(FONT_FILES.display, root)))
const sheet   = (index: number, title = 'The Outside Sensor in Home') => ({
  count : SECTIONS.length,
  index : index,
  label : 'Install',
  title : title
})

test('repeats a seeded sequence inside the range from 0 to 1', () => {
  const [first, second] = [seeded(41), seeded(41)]
  const drawn           = range(100).map(() => first())

  expect(drawn).toEqual(range(100).map(() => second()))
  expect(drawn.every((value) => value >= 0 && value < 1)).toBe(true)
})

test('reads the sky’s two ends at the two ends of HomeKit’s range', () => {
  expect([luxRange.min, luxRange.max, 0].map(sky.colorAt)).toEqual(['#1b1d31', '#f6e7a6', '#1b1d31'])
  expect(sky.channelsAt(luxRange.max)).toEqual([246, 231, 166])
})

test('moves a hue toward the ink until it holds the ratio', () => {
  const held = sky.holding(palette.ground, '#55497f', 4.8, palette.ink)

  expect(wcagContrast(held, palette.ground)).toBeGreaterThanOrEqual(4.8)
  expect(sky.holding('#000000', '#000000', 30, palette.ink)).toBe(palette.ink)
  expect(sky.mix('#000000', '#ffffff', 0)).toBe('#000000')
})

test('draws the site’s card at 1200 by 630, with its words at 4.5:1', async () => {
  const card                        = hillCard(day, faces, logo, palette)
  const { channels, height, width } = decode(await card.png())
  const words                       = await card.audit()

  expect({ channels, height, width }).toEqual({ channels: 4, height: 630, width: 1200 })
  expect(card.said).toEqual(['An outdoor light sensor', 'for Apple Home.', 'luxout.fyi'])
  expect(words.filter(({ contrast }) => contrast < 4.5)).toEqual([])
})

test('sets the tagline the front page opens on', async () => {
  const [first, second] = hillCard(day, faces, logo, palette).said

  expect(await readFile(join(site, 'index.md'), 'utf8')).toContain(`*${first} ${second}*`)
})

test.for([...new Set(titles.flatMap((title) => title.match(/W[a-z]/g) ?? []))])(
  'kerns the pair %s a page title sets, which Bodoni Moda leaves unkerned',
  (pair) => {
    const axes   = { opsz: 36, wght: 600 }
    const kerned = faces.set({ axes, face: 'display' }, 80, pair).width

    expect(kerned).toBeLessThan(bodoni.set(pair, { axes, size: 80 }).width)
  }
)

test('holds an hour and a pane of the window for every section', () => {
  expect(HOURS.length).toBeGreaterThanOrEqual(SECTIONS.length)
})

test.for(HOURS.map((hour, index) => ({ hour, index })))(
  'holds every word of the card at $hour minutes past midnight at 4.5:1',
  async ({ index }) => {
    const words = await sectionCard(day, faces, palette, sheet(index)).audit()

    expect(words.filter(({ contrast }) => contrast < 4.5)).toEqual([])
  }
)

test('names the section’s place, the hour, the true minus sign, and the reading', async () => {
  const words = await sectionCard(day, faces, palette, sheet(0)).audit()

  expect(words.map(({ text }) => text)).toEqual([
    'luxout.fyi',
    `INSTALL · 1 OF ${SECTIONS.length}`,
    'The Outside',
    'Sensor in Home',
    '06:33 · SUN −3°',
    '54.7',
    'lux'
  ])
})

test.for([
  { lines: 1, title: 'Limits' },
  { lines: 2, title: 'The Forecast Window' },
  { lines: 3, title: 'A Title Long Enough That Two Lines of Eighty Pixels Cannot Hold All of It' }
])('breaks $title into $lines lines', ({ lines, title }) => {
  expect(sectionCard(day, faces, palette, sheet(1, title)).said).toHaveLength(5 + lines)
})

test('writes the site’s card and each page’s card as PNGs in the output directory', async ({ outDir }) => {
  await renderCards(root, SECTIONS)({ outDir, pages: ['index.md', 'install/home.md'], srcDir: site })

  const signature = async (path: string) =>
    (await readFile(join(outDir, 'cards', path))).subarray(1, 4).toString()

  expect([await signature('index.png'), await signature('install/home.png')]).toEqual(['PNG', 'PNG'])
})

test('fails on a page in no section', async ({ outDir }) => {
  await expect(renderCards(root, SECTIONS)({ outDir, pages: ['stray.md'], srcDir: site }))
    .rejects.toThrow('stray.md')
})
