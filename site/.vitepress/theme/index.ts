import { type Theme, inBrowser }                from 'vitepress'
import DefaultTheme                             from 'vitepress/theme-without-fonts'
import { type Component, defineAsyncComponent } from 'vue'

import { writeTiming }       from '../lib/motion/timing.ts'
import type { WidgetName }   from '../lib/widgets/placements.ts'
import { LuxScale }          from './components/daylight/lux-scale.ts'
import { TheGap }            from './components/daylight/the-gap.ts'
import { LocationSearch }    from './components/search/location-search.ts'
import { SettingsReference } from './components/settings/settings-reference.ts'
import { TableFold }         from './controls/table-fold.ts'

import './styles/widgets.css'

const WIDGETS = {
  LocationSearch    : LocationSearch,
  LuxScale          : LuxScale,
  SettingsReference : SettingsReference,
  TheGap            : TheGap,

  DayEstimate: defineAsyncComponent(async () =>
    (await import('./components/daylight/day-estimate.ts')).DayEstimate
  ),

  SunPath: defineAsyncComponent(async () =>
    (await import('./components/daylight/sun-path.ts')).SunPath
  ),

  TheCloudFactor: defineAsyncComponent(async () =>
    (await import('./components/daylight/the-cloud-factor.ts')).TheCloudFactor
  ),

  ThreeFactors: defineAsyncComponent(async () =>
    (await import('./components/daylight/three-factors.ts')).ThreeFactors
  ),

  TwilightBridge: defineAsyncComponent(async () =>
    (await import('./components/daylight/twilight-bridge.ts')).TwilightBridge
  )
} satisfies Record<WidgetName, Component>

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    for (const [name, component] of Object.entries({ ...WIDGETS, TableFold })) app.component(name, component)

    if (inBrowser) writeTiming(document.documentElement)
  }
} satisfies Theme
