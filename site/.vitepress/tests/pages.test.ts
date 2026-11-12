import { readFile } from 'node:fs/promises'
import { join }     from 'node:path'

import { createMarkdownRenderer } from 'vitepress'
import { expect, it }             from 'vitest'

import { CLOUD_TUNING }              from '../../../src/daylight/cloud-factor.ts'
import { REQUEST_TUNING }            from '../../../src/weather/client.ts'
import { SCHEDULE_TUNING }           from '../../../src/weather/schedule.ts'
import config                        from '../config.ts'
import { cloudSteps }                from '../lib/daylight/cloud-steps.ts'
import { dayDial }                   from '../lib/daylight/day-dial.ts'
import { factorDay }                 from '../lib/daylight/factor-day.ts'
import { SampleDay }                 from '../lib/daylight/sample-day.ts'
import { sunYear }                   from '../lib/daylight/sun-year.ts'
import { replaySearch }              from '../lib/search/replay.ts'
import { exampleBlock, settingRows } from '../lib/settings/rows.ts'
import { PLACEMENTS, WIDGET_NAMES }  from '../lib/widgets/placements.ts'
import * as blocks                   from './common/blocks.ts'
import { data }                      from './common/data/daylight.ts'

const day               = SampleDay.record()
const { gap, luxScale } = data
const rows              = await settingRows()
const site              = join(import.meta.dirname, '..', '..')
const dial              = dayDial(day)
const md                = await createMarkdownRenderer(site, config.markdown)
const year              = sunYear(day)
const pageBlocks: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'estimate/altitude.md'   : { 'sun-lede': blocks.sunLede(year), 'sun-table': blocks.sunTable(year) },
  'estimate/limits.md'     : { 'night-limit': blocks.nightWords(luxScale) },
  'install/place.md'       : { 'search-stages': blocks.searchTable(await replaySearch()) },
  'sensors/outside.md'     : { 'lux-decades': blocks.luxTable(luxScale), 'lux-lede': luxScale.lede },
  'settings/thresholds.md' : { 'threshold-levels': blocks.thresholdLevels(rows) },

  'estimate/clear-sky.md': {
    'bridge-table' : blocks.bridgeTable(day.sky),
    'bridge-words' : blocks.bridgeWords(day.sky),
    'curve-levels' : blocks.levelsTable(day.sky)
  },

  'estimate/cloud-factor.md': {
    'cloud-floor' : blocks.floorWords(CLOUD_TUNING),
    'cloud-table' : blocks.cloudTable(cloudSteps(day))
  },

  'estimate/failed-fetches.md': {
    'fetch-reach' : blocks.fetchReach(REQUEST_TUNING),
    'fetch-retry' : blocks.fetchRetry(SCHEDULE_TUNING.retry, REQUEST_TUNING.timeout)
  },

  'estimate/forecast-window.md': {
    'window-request' : blocks.requestWords(REQUEST_TUNING),
    'window-sample'  : blocks.windowWords(day)
  },

  'estimate/index.md': {
    'dial-lede'    : blocks.dialLede(dial),
    'dial-table'   : blocks.dialTable(dial),
    'factor-table' : blocks.factorTable(factorDay(day))
  },

  'sensors/thresholds.md': {
    'gap-direction' : blocks.gapDirection(gap),
    'gap-table'     : blocks.gapTable(gap)
  },

  'settings/index.md': {
    'settings-block' : `\`\`\`json\n${JSON.stringify(await exampleBlock(), null, 2)}\n\`\`\``,
    'settings-table' : blocks.settingsTable(rows)
  }
}

it.each(Object.entries(pageBlocks))('carries in %s what the declarations yield', async (page, fills) => {
  const path = join(site, page)

  await expect(blocks.fillMarkers(await readFile(path, 'utf8'), fills)).toMatchFileSnapshot(path)
})

it.each(PLACEMENTS)('places $widget and its fold on $page', async ({ fold, page, widget }) => {
  const html = md.render(await readFile(join(site, page), 'utf8'), { relativePath: page })

  expect(html).toContain(`<${widget}`)
  expect(html).toContain(`<TableFold summary="${fold}">`)
})

it('quotes on install/home.md the line the platform logs for a setting at fault', async () => {
  const page     = await readFile(join(site, 'install', 'home.md'), 'utf8')
  const platform = await readFile(join(site, '..', 'src', 'platform', 'dynamic.ts'), 'utf8')

  expect(platform).toContain(/(?<=`)Outside reads[^`]+/.exec(page)![0])
})

it('quotes on estimate/failed-fetches.md each line the plugin logs', async () => {
  const page    = await readFile(join(site, 'estimate', 'failed-fetches.md'), 'utf8')
  const sources = await Promise.all(['weather/failure.ts', 'sensor/reading.ts'].map((path) =>
    readFile(join(site, '..', 'src', path), 'utf8')
  ))
  const lines  = page.slice(page.indexOf('## Lines in the Log')).matchAll(/^\| `([^`]+)` \|/gm)
  const quoted = lines.map(([, line]) => line!).toArray()

  expect(quoted).not.toEqual([])
  expect(quoted.filter((line) => !sources.some((source) => source.includes(line)))).toEqual([])
})

it('places each widget once', () => {
  expect(new Set(WIDGET_NAMES).size).toBe(WIDGET_NAMES.length)
})

it('writes no component tag into a page’s Markdown', async () => {
  const pages = await Promise.all(PLACEMENTS.map(({ page }) => readFile(join(site, page), 'utf8')))

  expect(pages.filter((text) => WIDGET_NAMES.some((name) => text.includes(`<${name}`)))).toEqual([])
})

it('replaces what sits between a pair of markers, leaving the page around them', () => {
  const page = 'before\n\n<!-- table -->\n\nold\n\n<!-- /table -->\n\nafter\n'

  expect(blocks.fillMarkers(page, { table: 'new' }))
    .toBe('before\n\n<!-- table -->\n\nnew\n\n<!-- /table -->\n\nafter\n')
})

it('fills an empty pair', () => {
  expect(blocks.fillMarkers('<!-- a -->\n<!-- /a -->', { a: 'x' })).toBe('<!-- a -->\n\nx\n\n<!-- /a -->')
})

it.each([
  { name: 'a name the page does not mark', page: 'nothing' },
  { name: 'a closing marker ahead of its opening', page: '<!-- /a --> <!-- a -->' }
])('fails on $name', ({ page }) => {
  expect(() => blocks.fillMarkers(page, { a: 'x' })).toThrow('The page marks no block named a')
})
