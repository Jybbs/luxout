import { least, range } from 'd3-array'

import { Place }           from '../../../../src/config/place.ts'
import type { Box, Point } from '../cards/card.ts'
import { formatPlace }     from '../daylight/format.ts'
import { tenth }           from '../daylight/tenth.ts'

export type MarkKey = (typeof MARK_KEYS)[number]

/**
 * The kilometers across one cell of RRFS, the 3 km model Open-Meteo's
 * 15-minute forecast comes from over the contiguous United States.
 */
const CELL_KM        = 3
const FOOT           = 34       // The drawing's units beneath the cell, holding its scale
const KM_PER_DEGREE  = 111.195  // The kilometers in a degree of latitude at the Earth's mean radius
const MARK_KEYS      = ['place', 'pair', 'area', 'cell'] as const
const NEAR           = 10       // The drawing's units within which a pointer names the place or the pair
const ORIGIN         = 1        // The drawing's units from its edges to the cell's
const SIDE           = 400      // The drawing's units across the cell
const STEP           = 0.01     // The degrees between two pairs of rounded coordinates

/**
 * One row of the drawing's key, naming a mark beside its figure.
 */
export interface PlaceMark {
  readonly key   : MarkKey
  readonly name  : string
  readonly value : string
}

/**
 * One cell of the forecast grid tiled by the areas that round to each pair of
 * coordinates, each tile cut to the cell, in the drawing's units, with the
 * area holding a place filled.
 */
export interface RoundedPlace {
  readonly area   : Box
  readonly cell   : Box
  readonly count  : number
  readonly dim    : string
  readonly height : number
  readonly label  : string
  readonly marks  : readonly PlaceMark[]
  readonly pair   : Point
  readonly place  : Point
  readonly scale  : { readonly word: string, readonly x: number, readonly y: number }
  readonly tiles  : readonly Box[]
  readonly width  : number
}

function clipped({ height, width, x, y }: Box, cell: Box): Box[] {
  const left   = Math.max(x, cell.x)
  const top    = Math.max(y, cell.y)
  const right  = Math.min(x + width, cell.x + cell.width)
  const bottom = Math.min(y + height, cell.y + cell.height)

  return right > left && bottom > top
    ? [{ height: tenth(bottom - top), width: tenth(right - left), x: left, y: top }]
    : []
}

function inside({ height, width, x, y }: Box, [px, py]: Point): boolean {
  return px >= x && px <= x + width && py >= y && py <= y + height
}

/**
 * Finds the mark under `point` in the drawing's units, the place or the pair
 * where either lies within reach, the nearer of the two where both do, then
 * the area, then the cell.
 */
export function markAt(
  { area, cell, pair, place } : RoundedPlace,
  point                       : Point
): MarkKey | undefined {
  const near = least(
    [{ at: place, key: 'place' as const }, { at: pair, key: 'pair' as const }]
      .map(({ at, key }) => ({ away: Math.hypot(point[0] - at[0], point[1] - at[1]), key }))
      .filter(({ away }) => away <= NEAR),
    ({ away }) => away
  )

  if (near) return near.key

  if (inside(area, point)) return 'area'

  return inside(cell, point) ? 'cell' : undefined
}

/**
 * Lays out the cell centered on the stored pair of coordinates `pair`, scaled
 * so the cell spans the drawing.
 */
export function roundedPlace(pair: Place): RoundedPlace {
  const tall  = STEP * KM_PER_DEGREE
  const wide  = tall * Math.cos(pair.latitude * Math.PI / 180)
  const scale = SIDE / CELL_KM
  const along = (km: number) => tenth(ORIGIN + (km + CELL_KM / 2) * scale)
  const x     = (east: number) => along((east - pair.longitude) / STEP * wide)
  const y     = (north: number) => along((pair.latitude - north) / STEP * tall)
  const boxOf = ({ latitude: north, longitude: east }: Place): Box => {
    const [left, top] = [x(east - STEP / 2), y(north + STEP / 2)]
    const height      = tenth(y(north - STEP / 2) - top)

    return { height, width: tenth(x(east + STEP / 2) - left), x: left, y: top }
  }

  const cell          = { height: SIDE, width: SIDE, x: ORIGIN, y: ORIGIN }
  const center: Point = [x(pair.longitude), y(pair.latitude)]
  const edge          = ORIGIN + SIDE
  const count         = Math.round(CELL_KM ** 2 / (tall * wide))
  const size          = `${tall.toFixed(2)} by ${wide.toFixed(2)} km`
  const sent          = formatPlace(pair)
  const reach         = range(-3, 4)

  return {
    area   : boxOf(pair),
    cell   : cell,
    count  : count,
    dim    : `M${ORIGIN} ${edge + 12}H${edge}`
           + [ORIGIN, edge].map((end) => `M${end} ${edge + 8}V${edge + 16}`).join(''),
    height : edge + FOOT,
    label  : `One forecast cell ${CELL_KM} km across, tiled by the areas that round to each pair of `
           + `coordinates, about ${count} of them, each ${size}, with the area that rounds to the `
           + `stored and sent pair ${sent} filled and the pair at its center`,
    pair   : center,
    place  : center,
    scale  : { word: `${CELL_KM} km`, x: ORIGIN + SIDE / 2, y: edge + 24 },
    width  : SIDE + 2 * ORIGIN,

    marks: [
      { key: 'place', name: 'Stored', value: sent },
      { key: 'pair', name: 'Sent', value: sent },
      { key: 'area', name: 'Rounds to that pair', value: size },
      { key: 'cell', name: 'One forecast cell', value: `${CELL_KM} km, about ${count} areas` }
    ],

    tiles: reach.flatMap((north) => reach.flatMap((east) =>
      clipped(boxOf(new Place(pair.latitude + north * STEP, pair.longitude + east * STEP)), cell)
    ))
  }
}
