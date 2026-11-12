import { readFile } from 'node:fs/promises'

import { AtRule, type Root, parse } from 'postcss'

import { Tokens } from '../../lib/theme/tokens.ts'

const DARK   = '(prefers-color-scheme: dark)'
const tokens = await Tokens.read(new URL('../../', import.meta.url))

/**
 * Reads the sheet that styles the frame `name` opens on, writing each `var()`
 * as the value the theme's tokens give it, in the dark scheme inside the
 * sheet's dark media query and in the light scheme everywhere else.
 */
export async function frameSheet(name: string): Promise<Root> {
  const root = parse(await readFile(new URL(`../../lib/daylight/${name}-frame.css`, import.meta.url), 'utf8'))

  root.walkDecls((declaration) => {
    const query  = declaration.parent?.parent
    const scheme = query instanceof AtRule && query.params === DARK ? 'dark' : 'light'

    declaration.value = tokens.follow(declaration.value, scheme)
  })

  return root
}
