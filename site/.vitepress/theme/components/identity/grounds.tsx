import { data }        from '../../../lib/identity/identity.data.ts'
import type { Scheme } from '../../../lib/theme/tokens.ts'

/**
 * The ink the logo takes on each scheme's ground, by the token it reads.
 */
export const INK = data.logo.construction.ink

/**
 * The palette color each scheme's ground holds, Cararra under the light scheme
 * and Near Black under the dark.
 */
export const GROUND = data.grounds

/**
 * The inline style that sets a box on `scheme`'s ground with its ink, so the
 * box keeps its ground whatever scheme the page around it takes.
 */
export function onGround(scheme: Scheme): Record<string, string> {
  return { background: `var(${GROUND[scheme].token})`, color: `var(${INK[scheme]})` }
}
