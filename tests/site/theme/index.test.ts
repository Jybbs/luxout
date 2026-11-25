/** @vitest-environment happy-dom */
import { readFile }                     from 'node:fs/promises'
import { join }                         from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { parse }                           from 'postcss'
import DefaultTheme                        from 'vitepress/theme-without-fonts'
import { expect, it, vi }                  from 'vitest'
import { type VNode, createApp, nextTick } from 'vue'

import { useMotion }    from '../../../site/.vitepress/lib/motion/motion.ts'
import { Tokens }       from '../../../site/.vitepress/lib/theme/tokens.ts'
import { WIDGET_NAMES } from '../../../site/.vitepress/lib/widgets/placements.ts'
import { PauseSwitch }  from '../../../site/.vitepress/theme/controls/pause-switch.tsx'
import theme            from '../../../site/.vitepress/theme/index.ts'
import { site }         from '../common/paths.ts'

const vitepress = vi.hoisted(() => ({
  get inBrowser() {
    return true
  }
}))

vi.mock('vitepress', () => vitepress)
vi.mock('vitepress/theme-without-fonts', () => ({ default: { Layout: 'Layout' } }))
vi.mock('../../../site/.vitepress/lib/credit/credit.data.ts', () => import('../common/data/credit.ts'))
vi.mock('../../../site/.vitepress/lib/daylight/daylight.data.ts', () => import('../common/data/daylight.ts'))
vi.mock('../../../site/.vitepress/lib/front/front.data.ts', () => import('../common/data/front.ts'))
vi.mock('../../../site/.vitepress/lib/search/search.data.ts', () => import('../common/data/search.ts'))
vi.mock('../../../site/.vitepress/lib/settings/settings.data.ts', () => import('../common/data/settings.ts'))

const source  = await readFile(join(site, '.vitepress', 'theme', 'index.ts'), 'utf8')
const tokens  = await Tokens.read(pathToFileURL(`${site}/.vitepress/`))
const sheets  = await Promise.all(source.matchAll(/^import '(@fontsource-variable\/[^']+)'$/gm)
  .map(([, name]) => readFile(fileURLToPath(import.meta.resolve(name!)), 'utf8')))
const faces   = sheets.flatMap((sheet) => parse(sheet).nodes
  .filter((node) => node.type === 'atrule')
  .filter(({ name }) => name === 'font-face')
  .map((face) => Object.fromEntries(face.nodes!
    .filter((node) => node.type === 'decl')
    .map(({ prop, value }) => [prop, value]))))
const context = () => ({ app: createApp({}), router: {} as never, siteData: {} as never })

it('extends the default theme that leaves out its bundled face', () => {
  expect(theme.extends).toBe(DefaultTheme)
})

it('registers each widget a placement names, and the fold beneath it', () => {
  const enhanced = context()

  theme.enhanceApp(enhanced)

  expect([...WIDGET_NAMES, 'TableFold'].filter((name) => !enhanced.app.component(name))).toEqual([])
})

it('passes the hero, the Day Strip, and the pause switch into the layout’s slots', () => {
  expect(Object.keys(theme.Layout().children as object)).toEqual([
    'home-hero-after', 'home-hero-info', 'nav-bar-content-after', 'nav-screen-content-after'
  ])
})

it.for([
  ['nav-bar-content-after', null],
  ['nav-screen-content-after', { row: true }]
] as const)('passes the pause switch into %s with the props %o', ([slot, props]) => {
  const slots = theme.Layout().children as Record<string, () => VNode>

  expect(slots[slot]!()).toMatchObject({ props, type: PauseSwitch })
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

it.for([
  { axis: 'opsz', token: '--luxout-font-display' },
  { axis: 'opsz', token: '--vp-font-family-base' },
  { axis: 'wght', token: '--vp-font-family-mono' }
])(
  'imports the Fontsource sheet setting the upright face $token opens on along its $axis axis',
  ({ axis, token }) => {
    const family = /^'[^']+'/.exec(tokens.resolve(token, 'light'))![0]

    expect(faces).toContainEqual(expect.objectContaining({
      'font-family' : family,
      'font-style'  : 'normal',
      'src'         : expect.stringMatching(new RegExp(`-${axis}-normal\\.woff2\\)`))
    }))
  }
)
