import type { TransformResult } from 'vite'
import { expect, it }           from 'vitest'

import { LAYER, layerTheme } from '../../../lib/config/layer.ts'

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
  expect(wrap('.a { color: red }\n.b { color: blue }', id))
    .toEqual({ code: `@layer ${LAYER} {.a { color: red }\n.b { color: blue }\n}`, map: null })
})

it.each([
  '/site/.vitepress/theme/styles/tokens.css',
  `${THEME}/components/VPNav.vue`,
  `${THEME}/components/VPNav.vue?vue&type=script&setup=true&lang.ts`,
  '/site/node_modules/tailwindcss/theme.css'
])('leaves %s as it is', (id) => {
  expect(wrap('.a { color: red }', id)).toBeUndefined()
})
