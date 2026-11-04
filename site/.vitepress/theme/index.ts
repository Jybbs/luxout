import { type Theme, inBrowser } from 'vitepress'
import DefaultTheme              from 'vitepress/theme-without-fonts'
import type { Component }        from 'vue'

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
  TheGap            : TheGap
} satisfies Record<WidgetName, Component>

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    for (const [name, component] of Object.entries({ ...WIDGETS, TableFold })) app.component(name, component)

    if (inBrowser) writeTiming(document.documentElement)
  }
} satisfies Theme
