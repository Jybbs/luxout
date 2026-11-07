import type { DefaultTheme, HeadConfig } from 'vitepress'

import { addressOf } from '../logo/logo.ts'
import { SCHEMES }   from '../theme/tokens.ts'

/**
 * Links the mark in each scheme as the favicon, the browser taking the one
 * whose scheme the reader's system prefers.
 */
export const favicons: HeadConfig[] = SCHEMES.map((scheme) => ['link', {
  href  : addressOf('mark', scheme),
  media : `(prefers-color-scheme: ${scheme})`,
  rel   : 'icon',
  type  : 'image/svg+xml'
}])

/**
 * Shows the title in the navigation bar in the form matching the site's scheme.
 */
export const title: DefaultTheme.ThemeableImage = {
  alt   : 'luxout',
  dark  : addressOf('title', 'dark'),
  light : addressOf('title', 'light')
}
