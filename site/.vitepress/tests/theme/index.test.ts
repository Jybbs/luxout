/** @vitest-environment happy-dom */
import DefaultTheme            from 'vitepress/theme-without-fonts'
import { expect, it, vi }      from 'vitest'
import { createApp, nextTick } from 'vue'

import { useMotion }    from '../../lib/motion/motion.ts'
import { WIDGET_NAMES } from '../../lib/widgets/placements.ts'
import theme            from '../../theme/index.ts'

const vitepress = vi.hoisted(() => ({
  get inBrowser() {
    return true
  }
}))

vi.mock('vitepress', () => vitepress)
vi.mock('vitepress/theme-without-fonts', () => ({ default: { Layout: 'Layout' } }))
vi.mock('../../lib/credit/credit.data.ts', () => import('../common/data/credit.ts'))
vi.mock('../../lib/daylight/daylight.data.ts', () => import('../common/data/daylight.ts'))
vi.mock('../../lib/front/front.data.ts', () => import('../common/data/front.ts'))
vi.mock('../../lib/search/search.data.ts', () => import('../common/data/search.ts'))
vi.mock('../../lib/settings/settings.data.ts', () => import('../common/data/settings.ts'))

const context = () => ({ app: createApp({}), router: {} as never, siteData: {} as never })

it('extends the default theme that leaves out its bundled face', () => {
  expect(theme.extends).toBe(DefaultTheme)
})

it('registers each widget a placement names, and the fold beneath it', () => {
  const enhanced = context()

  theme.enhanceApp(enhanced)

  expect([...WIDGET_NAMES, 'TableFold'].filter((name) => !enhanced.app.component(name))).toEqual([])
})

it('passes the hero and the Day Strip into the home layout’s slots', () => {
  expect(Object.keys(theme.Layout().children as object)).toEqual(['home-hero-after', 'home-hero-info'])
})

it('writes no timing during the server render', () => {
  vi.spyOn(vitepress, 'inBrowser', 'get').mockReturnValue(false)
  document.documentElement.style.removeProperty('--timing-move')

  theme.enhanceApp(context())

  expect(document.documentElement.style.getPropertyValue('--timing-move')).toBe('')
})

it('writes the timing onto the root element in the browser', () => {
  theme.enhanceApp(context())

  expect(document.documentElement.style.getPropertyValue('--timing-move')).not.toBe('')
})

it('marks the root element paused in the browser once the reader pauses the drawings', async () => {
  theme.enhanceApp(context())
  useMotion().set(true)
  await nextTick()

  expect(document.documentElement.hasAttribute('data-paused')).toBe(true)
})
