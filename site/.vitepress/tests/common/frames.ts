import { glob, readFile } from 'node:fs/promises'
import { join }           from 'node:path'

import { AtRule, type Root, parse } from 'postcss'

import { DARK, Tokens } from '../../lib/theme/tokens.ts'

const lib    = join(import.meta.dirname, '..', '..', 'lib')
const tokens = await Tokens.read(new URL('../../', import.meta.url))

/**
 * Reads the sheet that styles the frame `name` opens on, writing each value
 * that is one `var()` as the value the theme's tokens give it, in the dark
 * scheme inside the sheet's dark media query and in the light scheme everywhere
 * else.
 */
export async function frameSheet(name: string): Promise<Root> {
  const [path] = await Array.fromAsync(glob(`*/${name}-frame.css`, { cwd: lib }))
  const root   = parse(await readFile(join(lib, path!), 'utf8'))

  root.walkDecls((declaration) => {
    const query  = declaration.parent?.parent
    const scheme = query instanceof AtRule && query.params === DARK ? 'dark' : 'light'

    declaration.value = tokens.follow(declaration.value, scheme)
  })

  return root
}
