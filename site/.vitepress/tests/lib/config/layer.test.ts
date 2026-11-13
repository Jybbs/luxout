import { SourceMap, type SourceMapPayload } from 'node:module'

import type { TransformResult } from 'vite'
import { expect, it }           from 'vitest'

import { LAYER, layerTheme } from '../../../lib/config/layer.ts'

const SHEET  = '.a { color: red }\n.b { color: blue }'
const THEME  = '/site/node_modules/vitepress/dist/client/theme-default'
const plugin = layerTheme()
const wrap   = plugin.transform as (code: string, id: string) => TransformResult | undefined

it('wraps the default theme’s stylesheets before Vite compiles them', () => {
  expect(plugin.enforce).toBe('pre')
})

it.each([
  `${THEME}/styles/base.css`,
  `${THEME}/components/VPNav.vue?vue&type=style&index=0&scoped=3f6a2b1c&lang.css`
])('wraps %s in the vitepress layer, keeping each line where it was', (id) => {
  expect(wrap(SHEET, id)?.code).toBe(`@layer ${LAYER} {.a { color: red }\n.b { color: blue }\n}`)
})

it('maps each line of a wrapped stylesheet back to the line and column it came from', () => {
  const id  = `${THEME}/styles/base.css`
  const map = new SourceMap(wrap(SHEET, id)!.map as SourceMapPayload)

  expect([map.findEntry(0, 18), map.findEntry(1, 0)]).toMatchObject([
    { originalColumn: 0, originalLine: 0, originalSource: id },
    { originalColumn: 0, originalLine: 1, originalSource: id }
  ])
})

it.each([
  '/site/.vitepress/theme/styles/tokens.css',
  `${THEME}/components/VPNav.vue`,
  `${THEME}/components/VPNav.vue?vue&type=script&setup=true&lang.ts`,
  '/site/node_modules/tailwindcss/theme.css'
])('leaves %s as it is', (id) => {
  expect(wrap(SHEET, id)).toBeUndefined()
})
