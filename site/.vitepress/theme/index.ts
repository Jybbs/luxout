import { type Theme, inBrowser }                   from 'vitepress'
import DefaultTheme                                from 'vitepress/theme-without-fonts'
import { type Component, defineAsyncComponent, h } from 'vue'

import { writePaused }       from '../lib/motion/motion.ts'
import { writeTiming }       from '../lib/motion/timing.ts'
import type { WidgetName }   from '../lib/widgets/placements.ts'
import { LuxScale }          from './components/daylight/lux-scale.tsx'
import { TheGap }            from './components/daylight/the-gap.tsx'
import { DayStrip }          from './components/front/day-strip.tsx'
import { FrontHero }         from './components/front/front-hero.tsx'
import { SectionLamps }      from './components/front/section-lamps.tsx'
import { SourceLamps }       from './components/front/source-lamps.tsx'
import { LocationSearch }    from './components/search/location-search.tsx'
import { SettingsReference } from './components/settings/settings-reference.tsx'
import { TableFold }         from './controls/table-fold.tsx'

import '@fontsource-variable/bodoni-moda/opsz.css'
import '@fontsource-variable/bodoni-moda/opsz-italic.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import '@fontsource-variable/source-serif-4/opsz.css'
import '@fontsource-variable/source-serif-4/opsz-italic.css'
import './styles/tokens.css'
import './styles/front.css'
import './styles/day-strip.css'
import './styles/section-lamps.css'
import './styles/source-lamps.css'

const SLOTS = {
  'home-hero-after' : () => h('div', { class: 'front-strip' }, h(DayStrip)),
  'home-hero-info'  : () => h(FrontHero)
}
const WIDGETS = {
  LocationSearch    : LocationSearch,
  LuxScale          : LuxScale,
  SectionLamps      : SectionLamps,
  SettingsReference : SettingsReference,
  SourceLamps       : SourceLamps,
  TheGap            : TheGap,

  DayEstimate: defineAsyncComponent(async () =>
    (await import('./components/daylight/day-estimate.tsx')).DayEstimate
  ),

  DebugLine: defineAsyncComponent(async () =>
    (await import('./components/troubleshooting/debug-line.tsx')).DebugLine
  ),

  RequestClock: defineAsyncComponent(async () =>
    (await import('./components/privacy/request-clock.tsx')).RequestClock
  ),

  RoundedPlace: defineAsyncComponent(async () =>
    (await import('./components/privacy/rounded-place.tsx')).RoundedPlace
  ),

  SunPath: defineAsyncComponent(async () =>
    (await import('./components/daylight/sun-path.tsx')).SunPath
  ),

  TheCloudFactor: defineAsyncComponent(async () =>
    (await import('./components/daylight/the-cloud-factor.tsx')).TheCloudFactor
  ),

  ThreeFactors: defineAsyncComponent(async () =>
    (await import('./components/daylight/three-factors.tsx')).ThreeFactors
  ),

  TwilightBridge: defineAsyncComponent(async () =>
    (await import('./components/daylight/twilight-bridge.tsx')).TwilightBridge
  )
} satisfies Record<WidgetName, Component>

export default {
  Layout  : () => h(DefaultTheme.Layout, null, SLOTS),
  extends : DefaultTheme,
  enhanceApp({ app }) {
    for (const [name, component] of Object.entries({ ...WIDGETS, TableFold })) app.component(name, component)

    if (!inBrowser) return

    writePaused(document.documentElement)
    writeTiming(document.documentElement)
  }
} satisfies Theme
