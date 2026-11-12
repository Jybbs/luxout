import { lerp }            from 'culori'
import { greatest, range } from 'd3-array'
import { polygonHull }     from 'd3-polygon'
import { type VNode, h }   from 'vue'

import { tenth } from '../daylight/tenth.ts'
import * as card from './card.ts'
import { mix }   from './sky.ts'

/**
 * The gaps and colors a window takes when drawn flat on the card, in pixels.
 */
interface Glazing {
  bar   : number
  frame : string
  glass : readonly [from: string, to: string]
  rim   : number
}

/**
 * The span of a window or one of its panes on the back wall.
 */
interface Span {
  x0 : number
  x1 : number
  y0 : number
  y1 : number
}

/**
 * A point in a room whose x runs west to the viewer's right, y up, and z north
 * toward the viewer, in meters from the middle of the back wall's foot.
 */
type Vector = readonly [x: number, y: number, z: number]

const BOARD = 0.13  // The height of the skirting board, in meters
const COLS  = 3
const DEPTH = 3.7                  // Meters from the back wall to the room's open side
const EYE   = { y: 1.65, z: 5.8 }  // The viewer's height and distance from the back wall, in meters
const FOCAL = 640                  // Pixels on the card per meter at one meter from the viewer
const GLASS = { bar: 9, frame: '#6b685f', glass: ['#141413', '#0e0e0e'], rim: 10 } as const satisfies Glazing
const HALF  = 5.2   // Meters from the middle of the back wall to each side wall
const HIGH  = 3.6   // The height of the ceiling, in meters
const INSET = 0.08  // The width of a glazing bar in the room, in meters
const LEAN  = 56    // The altitude in degrees the soft patch of a low sun's pane casts from
const ROWS  = 2
const SEAMS = 3  // Meters from the back wall each floor seam runs toward the viewer
const SPAN  = { x0: 1.4, x1: 4.4, y0: 1.15, y1: 3.3 }
const VIEW  = { x: 600, y: 214 }  // The point on the card the viewer looks toward

/**
 * A south-facing room seen from inside, looking south at the six-pane window in
 * its back wall, each surface a share of the way from `ground` to `ink`.
 */
export class Room {
  readonly #card   : card.Card
  readonly #ground : string
  readonly #ink    : string

  constructor(drawing: card.Card, ground: string, ink: string) {
    this.#card   = drawing
    this.#ground = ground
    this.#ink    = ink
  }

  /**
   * Reads the y on the card where the back wall meets the floor.
   */
  get foot(): number {
    return at([0, 0, 0])[1]
  }

  /**
   * Finds the window's rectangle on the card.
   */
  get glazed(): card.Box {
    const [x, y]          = at([SPAN.x0, SPAN.y1, 0])
    const [right, bottom] = at([SPAN.x1, SPAN.y0, 0])

    return { height: bottom - y, width: right - x, x, y }
  }

  /**
   * Draws the shaft of light from `pane` to the shapes its cast lands on,
   * fading from the glass to the far end of the cast.
   */
  beam(cast: readonly Vector[][], color: string, pane: Span, strength: number): void {
    const glass = flat(this.#corners(pane))
    const lit   = cast.flatMap(flat)
    const hull  = polygonHull([...glass, ...lit].map(([x, y]): [number, number] => [x, y]))!
    const near  = glass[0]!
    const far   = greatest([near, ...lit], ([, y]) => y)!
    const fill  = this.#card.linear(near, far, [[0, color, strength], [1, color, strength * 0.25]])

    this.#card.add(this.#card.blurred(22, 1, [card.polygon(hull, { fill })]))
  }

  /**
   * Follows the corners of `pane` along `travel` onto the floor and the side
   * wall it reaches, each shape clipped to its surface.
   */
  cast(pane: Span, travel: Vector): Vector[][] {
    const corners = this.#corners(pane)
    const side    = travel[0] < 0 ? -HALF : HALF
    const floor   = within(landed(corners, 1, travel, 0), { 0: [-HALF, HALF], 2: [0, DEPTH] })
    const wall    = Math.abs(travel[0]) > 1e-6
                  ? within(landed(corners, 0, travel, side), { 1: [0, HIGH], 2: [0, DEPTH] })
                  : []

    return [floor, wall].filter((poly) => poly.length > 2)
  }

  /**
   * Finds the rectangle on the card of pane `index`, counted in reading order,
   * inside the bars around it.
   */
  flatPane(index: number): card.Box {
    const { height, width, x, y } = this.glazed

    const { bar } = GLASS
    const col     = index % COLS
    const row     = Math.floor(index / COLS)
    const left    = x + width * col / COLS + (col ? bar / 2 : 0)
    const right   = x + width * (col + 1) / COLS - (col < COLS - 1 ? bar / 2 : 0)
    const top     = y + height * row / ROWS + (row ? bar / 2 : 0)
    const bottom  = y + height * (row + 1) / ROWS - (row < ROWS - 1 ? bar / 2 : 0)

    return { height: bottom - top, width: right - left, x: left, y: top }
  }

  /**
   * Draws the shapes of a cast as a soft bloom under a sharper core.
   */
  light(cast: readonly Vector[][], color: string): void {
    this.#card.add(
      this.#card.blurred(16, 0.46, this.shapes(cast, color)),
      this.#card.blurred(1.1, 0.94, this.shapes(cast, color))
    )
  }

  /**
   * Finds the span of pane `index` in the room, counted in reading order, inset
   * by half a glazing bar so its cast keeps the gaps the bars leave.
   */
  pane(index: number): Span {
    const col = index % COLS
    const row = Math.floor(index / COLS)

    return {
      x0 : lerp(SPAN.x0, SPAN.x1, col / COLS) + INSET / 2,
      x1 : lerp(SPAN.x0, SPAN.x1, (col + 1) / COLS) - INSET / 2,
      y0 : lerp(SPAN.y1, SPAN.y0, (row + 1) / ROWS) + INSET / 2,
      y1 : lerp(SPAN.y1, SPAN.y0, row / ROWS) - INSET / 2
    }
  }

  /**
   * Projects the shapes of a cast onto the card.
   */
  shapes(cast: readonly Vector[][], fill: string): VNode[] {
    return cast.map((poly) => card.polygon(flat(poly), { fill }))
  }

  /**
   * Draws the back wall, the side walls, the floor, the skirting board, and the
   * seams between them, returning the wall's color.
   */
  shell(floor: number, wall: number): string {
    const tone  = (share: number) => mix(this.#ground, this.#ink, share)
    const foot  = at([-HALF, 0, 0])
    const far   = at([HALF, 0, 0])
    const top   = at([HALF, HIGH, 0])
    const start = at([-HALF, HIGH, 0])
    const plane = flat([[-HALF, 0, 0], [HALF, 0, 0], [HALF, 0, DEPTH], [-HALF, 0, DEPTH]])
    const east  = flat([[-HALF, 0, 0], [-HALF, HIGH, 0], [-HALF, HIGH, DEPTH], [-HALF, 0, DEPTH]])
    const west  = flat([[HALF, 0, 0], [HALF, HIGH, 0], [HALF, HIGH, DEPTH], [HALF, 0, DEPTH]])
    const skirt = flat([[-HALF, 0, 0], [HALF, 0, 0], [HALF, BOARD, 0], [-HALF, BOARD, 0]])
    const seam  = ([x1, y1]: card.Point, [x2, y2]: card.Point, alpha: number) => h('path', {
      'd'              : `M${tenth(x1)} ${tenth(y1)}L${tenth(x2)} ${tenth(y2)}`,
      'stroke'         : '#000',
      'stroke-opacity' : alpha,
      'stroke-width'   : 1.5
    })
    const walls = this.#card.linear(
      [0, top[1]],
      [0, foot[1]],
      [[0, tone(wall * 0.8)], [1, tone(wall * 1.12)]]
    )
    const paved = this.#card.linear(
      [0, foot[1]],
      [0, card.HEIGHT],
      [[0, tone(floor * 1.1)], [1, tone(floor * 0.75)]]
    )

    this.#card.add(
      card.polygon([foot, far, top, start], { fill: walls }),
      card.polygon(east, { fill: tone(wall * 0.5) }),
      card.polygon(west, { fill: tone(wall * 0.5) }),
      card.polygon(plane, { fill: paved }),
      card.polygon(skirt, { fill: tone(wall * 0.62) }),
      seam(foot, far, 0.5),
      seam(far, top, 0.5),
      seam(start, foot, 0.5),
      seam(foot, at([-HALF, 0, SEAMS]), 0.4),
      seam(far, at([HALF, 0, SEAMS]), 0.4)
    )

    return tone(wall)
  }

  /**
   * Finds the direction of the soft patch of light under `pane` while the sun
   * is too low to cast on the floor, leaning sideways by the share that places
   * the patch straight beneath the pane on the card.
   */
  under({ x0, x1 }: Span): Vector {
    const lean = LEAN * Math.PI / 180

    return [-(x0 + x1) / 2 * Math.cos(lean) / EYE.z, -Math.sin(lean), Math.cos(lean)]
  }

  /**
   * Draws the window's frame and dark glass with pane `lit` holding the flat
   * color `sky`, its light spreading past its edge at the opacity `bloom` and
   * lighting the bars around it at the strength `caught`.
   */
  window(bloom: number, caught: number, lit: number, sky: string): void {
    const { frame, glass, rim } = GLASS
    const pane                  = this.flatPane(lit)

    this.#card.add(
      card.rect(card.around(this.glazed, rim), { fill: frame }),
      ...range(COLS * ROWS)
        .filter((index) => index !== lit)
        .map((index) => {
          const dark = this.flatPane(index)
          const fill = this.#card.linear(
            [dark.x, dark.y],
            [dark.x + dark.width, dark.y + dark.height],
            [[0, glass[0]], [1, glass[1]]]
          )

          return card.rect(dark, { fill })
        }),
      this.#card.blurred(30, bloom, [card.rect(card.around(pane, 10), { fill: sky })]),
      card.rect(pane, { fill: sky }),
      ...this.#caught(pane, sky, caught)
    )
  }

  #caught({ height, width, x, y }: card.Box, light: string, strength: number) {
    const { bar } = GLASS
    const fade    = [[0, light, strength], [1, light, strength * 0.25]] as const
    const bottom  = y + height
    const right   = x + width
    const runs: readonly (readonly [card.Box, card.Point, card.Point])[] = [
      [{ height: bar, width: width + 2 * bar, x: x - bar, y: y - bar }, [0, y], [0, y - bar]],
      [{ height: bar, width: width + 2 * bar, x: x - bar, y: bottom }, [0, bottom], [0, bottom + bar]],
      [{ height, width: bar, x: x - bar, y }, [x, 0], [x - bar, 0]],
      [{ height, width: bar, x: right, y }, [right, 0], [right + bar, 0]]
    ]

    return runs.map(([box, from, to]) => card.rect(box, { fill: this.#card.linear(from, to, fade) }))
  }

  #corners({ x0, x1, y0, y1 }: Span): Vector[] {
    return [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]]
  }
}

/**
 * Keeps the part of `poly` on one side of `value` along `axis`.
 */
function clipped(poly: readonly Vector[], above: boolean, axis: 0 | 1 | 2, value: number): Vector[] {
  const inside = (point: Vector) => above ? point[axis] >= value : point[axis] <= value

  return poly.flatMap((point, index) => {
    const next          = poly[(index + 1) % poly.length]!
    const share         = (value - point[axis]) / (next[axis] - point[axis])
    const cross: Vector = [
      lerp(point[0], next[0], share),
      lerp(point[1], next[1], share),
      lerp(point[2], next[2], share)
    ]

    return [...inside(point) ? [point] : [], ...inside(point) === inside(next) ? [] : [cross]]
  })
}

function flat(poly: readonly Vector[]): card.Point[] {
  return poly.map(at)
}

/**
 * Carries `poly` along `travel` until each point reaches `value` along `axis`.
 */
function landed(poly: readonly Vector[], axis: 0 | 1 | 2, travel: Vector, value: number): Vector[] {
  return poly.map((point) => {
    const share = (value - point[axis]) / travel[axis]

    return [point[0] + share * travel[0], point[1] + share * travel[1], point[2] + share * travel[2]]
  })
}

function within(poly: Vector[], ranges: Partial<Record<0 | 1 | 2, readonly [number, number]>>): Vector[] {
  return ([0, 1, 2] as const).reduce((kept, axis) => {
    const limit = ranges[axis]

    return limit === undefined ? kept : clipped(clipped(kept, true, axis, limit[0]), false, axis, limit[1])
  }, poly)
}

/**
 * Projects a point in the room onto the card.
 */
export function at([x, y, z]: Vector): card.Point {
  const depth = EYE.z - z

  return [VIEW.x + FOCAL * x / depth, VIEW.y - FOCAL * (y - EYE.y) / depth]
}

/**
 * Finds the direction the light of a sun at `azimuth` and `altitude`, in
 * degrees, travels through the room.
 */
export function travelOf(altitude: number, azimuth: number): Vector {
  const across = Math.cos(altitude * Math.PI / 180)
  const toward = azimuth * Math.PI / 180

  return [Math.sin(toward) * across, -Math.sin(altitude * Math.PI / 180), -Math.cos(toward) * across]
}
