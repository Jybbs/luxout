import { readFile }      from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { createMarkdownRenderer } from 'vitepress'
import { expect, it }             from 'vitest'
import { createSSRApp }           from 'vue'
import { renderToString }         from 'vue/server-renderer'

import config                        from '../config.ts'
import { replaySearch }              from '../lib/search/replay.ts'
import { exampleBlock, settingRows } from '../lib/settings/rows.ts'
import { PLACEMENTS, WIDGET_NAMES }  from '../lib/widgets/placements.ts'
import { gapDrawing }                from '../theme/components/daylight/gap-drawing.ts'
import { data }                      from './common/data/daylight.ts'
import * as tables                   from './common/tables.ts'

const framed            = PLACEMENTS.filter(({ frame }) => frame)
const { gap, luxScale } = data
const site              = join(import.meta.dirname, '..', '..')
const md                = await createMarkdownRenderer(site, config.markdown)
const pageBlocks: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'install/place.md'   : { 'search-stages': tables.searchTable(await replaySearch()) },
  'sensors/outside.md' : { 'lux-decades': tables.luxTable(luxScale), 'lux-lede': luxScale.lede },

  'sensors/thresholds.md': {
    'gap-direction' : `A sensor ${gap.direction}.`,
    'gap-table'     : tables.gapTable(gap)
  },

  'settings/index.md': {
    'settings-block' : `\`\`\`json\n${JSON.stringify(await exampleBlock(), null, 2)}\n\`\`\``,
    'settings-table' : tables.settingsTable(await settingRows())
  }
}

it.each(Object.entries(pageBlocks))('carries in %s what the declarations yield', async (page, blocks) => {
  const path = join(site, page)

  await expect(tables.fillMarkers(await readFile(path, 'utf8'), blocks)).toMatchFileSnapshot(path)
})

it('commits the frame the gap opens on, as the widget draws it', async () => {
  const layout = gap.layouts.at(-1)!
  const markup = await renderToString(createSSRApp({ render: () => gapDrawing(layout, gap) }))
  const sheet  = await readFile(new URL('../lib/daylight/the-gap-frame.css', import.meta.url), 'utf8')
  const frame  = markup.replace('</svg>', `<style>${sheet}</style></svg>`)

  await expect(`${frame}\n`).toMatchFileSnapshot(join(site, 'sensors', 'the-gap.svg'))
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

it.each(framed)('opens $widget on a frame that exists', async ({ frame, page }) => {
  await expect(readFile(join(site, dirname(page), frame!), 'utf8')).resolves.toContain('<svg')
})

it('places each widget once', () => {
  expect(PLACEMENTS.map(({ widget }) => widget).toSorted()).toEqual([...WIDGET_NAMES].toSorted())
})

it('writes no component tag into a page’s Markdown', async () => {
  const pages = await Promise.all(PLACEMENTS.map(({ page }) => readFile(join(site, page), 'utf8')))

  expect(pages.filter((text) => WIDGET_NAMES.some((name) => text.includes(`<${name}`)))).toEqual([])
})

it('replaces what sits between a pair of markers, leaving the page around them', () => {
  const page = 'before\n\n<!-- table -->\n\nold\n\n<!-- /table -->\n\nafter\n'

  expect(tables.fillMarkers(page, { table: 'new' }))
    .toBe('before\n\n<!-- table -->\n\nnew\n\n<!-- /table -->\n\nafter\n')
})

it('fills an empty pair', () => {
  expect(tables.fillMarkers('<!-- a -->\n<!-- /a -->', { a: 'x' })).toBe('<!-- a -->\n\nx\n\n<!-- /a -->')
})

it.each([
  { name: 'a name the page does not mark', page: 'nothing' },
  { name: 'a closing marker ahead of its opening', page: '<!-- /a --> <!-- a -->' }
])('fails on $name', ({ page }) => {
  expect(() => tables.fillMarkers(page, { a: 'x' })).toThrow('The page marks no block named a')
})
