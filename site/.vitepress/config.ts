import { join } from 'node:path'

import vueJsx           from '@vitejs/plugin-vue-jsx'
import { defineConfig } from 'vitepress'

import manifest            from '../../package.json' with { type: 'json' }
import { renderCards }     from './lib/cards/render.ts'
import { footnotesByWork } from './lib/citations/anchors.ts'
import { transformHead }   from './lib/config/head.ts'
import { favicons, title } from './lib/config/logo.ts'
import { buildNavigation } from './lib/config/navigation.ts'
import { transformPage }   from './lib/config/page-data.ts'
import { SECTIONS }        from './lib/config/sections.ts'
import { luxRange }        from './lib/daylight/homekit.ts'
import { PLACEMENTS }      from './lib/widgets/placements.ts'
import { placeWidgets }    from './lib/widgets/placing.ts'

const root = join(import.meta.dirname, '..')

export default defineConfig({
  buildEnd          : renderCards(new URL('./', import.meta.url), SECTIONS),
  cacheDir          : '../.cache/site/vitepress',
  cleanUrls         : true,
  description       : manifest.description,
  head              : favicons,
  themeConfig       : { ...buildNavigation(root, SECTIONS), logo: title, siteTitle: false },
  title             : manifest.displayName,
  transformHead     : transformHead(manifest.homepage),
  transformPageData : transformPage(manifest, luxRange, root, SECTIONS),

  markdown: {
    eagerFrontmatterInterpolation: false,
    config(md) {
      footnotesByWork(md)
      placeWidgets(md, PLACEMENTS)
    }
  },

  vite: {
    css     : { transformer: 'lightningcss' },
    plugins : [vueJsx({ tsTransform: 'built-in' })]
  }
})
