import { type Theme, inBrowser }                from 'vitepress'
import DefaultTheme                             from 'vitepress/theme-without-fonts'
import { type Component, defineAsyncComponent } from 'vue'

import { writeTiming }       from '../lib/motion/timing.ts'
import type { WidgetName }   from '../lib/widgets/placements.ts'
import { LuxScale }          from './components/daylight/lux-scale.tsx'
import { TheGap }            from './components/daylight/the-gap.tsx'
import { LocationSearch }    from './components/search/location-search.tsx'
import { SettingsReference } from './components/settings/settings-reference.tsx'
import { TableFold }         from './controls/table-fold.tsx'

import '@fontsource-variable/bodoni-moda/opsz.css'
import '@fontsource-variable/bodoni-moda/opsz-italic.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import '@fontsource-variable/source-serif-4/opsz.css'
import '@fontsource-variable/source-serif-4/opsz-italic.css'
import './styles/tokens.css'

const WIDGETS = {
  LocationSearch    : LocationSearch,
  LuxScale          : LuxScale,
  SettingsReference : SettingsReference,
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
  extends: DefaultTheme,
  enhanceApp({ app }) {
    for (const [name, component] of Object.entries({ ...WIDGETS, TableFold })) app.component(name, component)

    if (inBrowser) writeTiming(document.documentElement)
  }
} satisfies Theme
