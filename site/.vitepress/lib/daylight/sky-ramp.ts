import { formatHex, interpolate, wcagContrast } from 'culori'
import { greatest }                             from 'd3-array'

const INKS  = ['#1a1a1a', '#f2f1ee']
const shade = interpolate(
  [
    ['#1b1d31', 0],
    ['#2c2f5c', 0.38],
    ['#55497f', 0.55],
    ['#9b6176', 0.66],
    ['#d68b5c', 0.76],
    ['#e8c840', 0.86],
    ['#f6e7a6', 1]
  ],
  'oklab'
)

/**
 * Shades a position along the scale from dark to bright, where `0` is the floor
 * and `1` the ceiling.
 *
 * Returns:
 *   The fill as a hex color beside the ink that reads best on it.
 */
export function skyShade(position: number): { fill: string, ink: string } {
  const fill = formatHex(shade(position))

  return { fill, ink: greatest(INKS, (ink) => wcagContrast(fill, ink))! }
}
