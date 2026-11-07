import { Tokens } from '../theme/tokens.ts'

/**
 * The colors of the dark scheme the cards draw in.
 */
export interface Palette {
  ground : string
  ink    : string
  muted  : string
  sun    : string
}

/**
 * Reads the palette from the theme's tokens beneath `root`, the site's
 * `.vitepress` directory.
 */
export async function readPalette(root: URL): Promise<Palette> {
  const tokens = await Tokens.read(root)

  return {
    ground : tokens.resolve('--luxout-dark', 'dark'),
    ink    : tokens.resolve('--luxout-ground', 'dark'),
    muted  : tokens.resolve('--luxout-muted', 'dark'),
    sun    : tokens.resolve('--luxout-primary', 'dark')
  }
}
