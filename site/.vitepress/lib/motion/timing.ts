import { clamp } from '@vueuse/core'

/**
 * The length in milliseconds of each transition, which falls to `1` under
 * `prefers-reduced-motion`.
 */
export const DURATIONS = { fade: 200, hover: 150, move: 180, settle: 480 } as const
const EASING           = 'cubic-bezier(0.333, 0, 0.667, 1)'
/**
 * The length in milliseconds of each pause pacing a reader's input, which keeps
 * its length under `prefers-reduced-motion`.
 */
export const PAUSES = { dwell: 150, leave: 120, speech: 500 } as const
const REDUCED       = '(prefers-reduced-motion: reduce)'

/**
 * Reports whether the reader has asked for reduced motion.
 */
export function motionReduced(): boolean {
  return matchMedia(REDUCED).matches
}

/**
 * Eases `place` along smoothstep, holding at 0 below the span and 1 above it.
 */
export function smoothstep(place: number): number {
  const at = clamp(place, 0, 1)

  return at * at * (3 - 2 * at)
}

/**
 * Writes each duration and the easing onto the root element as custom
 * properties, and writes them again when the reader's preference changes.
 */
export function writeTiming(root: HTMLElement): void {
  const reduced = matchMedia(REDUCED)
  const write   = () => {
    for (const [name, length] of Object.entries(DURATIONS)) {
      root.style.setProperty(`--timing-${name}`, `${reduced.matches ? 1 : length}ms`)
    }
  }

  root.style.setProperty('--timing-ease', EASING)
  write()
  reduced.addEventListener('change', write)
}
