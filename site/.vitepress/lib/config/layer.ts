import MagicString     from 'magic-string'
import type { Plugin } from 'vite'

/**
 * Names the cascade layer the default theme's stylesheets sit in, which ranks
 * below Tailwind's since the theme imports the default theme ahead of its own
 * sheet.
 */
export const LAYER = 'vitepress'
/**
 * Matches each stylesheet the `vitepress` package's default theme loads, its
 * components' style blocks included.
 */
const THEME = /\/vitepress\/dist\/client\/theme-default\/.+\.css$/

/**
 * Builds the Vite plugin that wraps each stylesheet the default theme loads in
 * the cascade layer `LAYER`, before Vite or Vue compiles it.
 */
export function layerTheme(): Plugin {
  return {
    enforce   : 'pre',
    name      : 'luxout:layer-theme',
    transform : (code, id) => {
      if (!THEME.test(id)) return undefined

      const wrapped = new MagicString(code).prepend(`@layer ${LAYER} {`).append('\n}')

      return { code: wrapped.toString(), map: wrapped.generateMap({ hires: true, source: id }) }
    }
  }
}
