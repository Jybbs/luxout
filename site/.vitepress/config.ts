import { join } from 'node:path'

import { defineConfig } from 'vitepress'

import manifest            from '../../package.json' with { type: 'json' }
import { footnotesByWork } from './lib/citations/anchors.ts'
import { buildNavigation } from './lib/config/navigation.ts'
import { setFacts }        from './lib/config/page-data.ts'
import { SECTIONS }        from './lib/config/sections.ts'
import { luxRange }        from './lib/daylight/homekit.ts'
import { PLACEMENTS }      from './lib/widgets/placements.ts'
import { placeWidgets }    from './lib/widgets/placing.ts'

const root = join(import.meta.dirname, '..')

export default defineConfig({
  cacheDir          : '../.cache/site/vitepress',
  cleanUrls         : true,
  description       : manifest.description,
  themeConfig       : buildNavigation(root, SECTIONS),
  title             : manifest.displayName,
  transformPageData : setFacts(manifest, luxRange, root, SECTIONS),
  vite              : { css: { transformer: 'lightningcss' } },
  markdown          : {
    eagerFrontmatterInterpolation: false,
    config(md) {
      footnotesByWork(md)
      placeWidgets(md, PLACEMENTS)
    }
  }
})
