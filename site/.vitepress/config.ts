import { defineConfig } from 'vitepress'

import manifest            from '../../package.json' with { type: 'json' }
import { buildNavigation } from './lib/config/navigation.ts'
import { setFacts }        from './lib/config/page-data.ts'
import { SECTIONS }        from './lib/config/sections.ts'

export default defineConfig({
  cacheDir          : '../.cache/site/vitepress',
  cleanUrls         : true,
  description       : manifest.description,
  markdown          : { eagerFrontmatterInterpolation: false },
  themeConfig       : buildNavigation(SECTIONS),
  title             : manifest.displayName,
  transformPageData : setFacts(manifest),
  vite              : { css: { transformer: 'lightningcss' } }
})
