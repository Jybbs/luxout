import { max }           from 'd3-array'
import { type VNode, h } from 'vue'

import * as faces              from '../cards/faces.ts'
import { SampleDay }           from '../daylight/sample-day.ts'
import { SVG_NAMESPACE }       from '../daylight/svg.ts'
import { tenth }               from '../daylight/tenth.ts'
import { type Scheme, Tokens } from '../theme/tokens.ts'
import * as credit             from './credit.ts'
import * as drawing            from './seal-drawing.ts'

const LEDE: faces.Voice = { axes: { opsz: 16, wght: 400 }, face: 'italic' }
/**
 * The README's plaque in pixels, the seal centered over the heading, the
 * lede's lines, and a rule broken by a dot at `rule.y`, each line of words set
 * at the baseline `y` lists for it.
 */
const PLAQUE = {
  heading : { size: 25, y: 134 },
  height  : 210,
  lede    : { size: 16, y: [164, 186] },
  rule    : { dot: 1.8, gap: 7, length: 33, stroke: 1, y: 206 },
  width   : 296
}

/**
 * Draws the seal the Open-Meteo credit stands beside, its rim lettered in the
 * mono face around the sample day's forecast, each 15-minute step of the
 * forecast window a ray from a half sun as long as the sunlight it holds.
 */
export class Seal {
  readonly marks   : drawing.SealMarks
  readonly #faces  : faces.Faces
  readonly #tokens : Tokens

  /**
   * Reads the faces and the theme's tokens from beneath `root`, the site's
   * `.vitepress` directory.
   */
  static async read(root: URL): Promise<Seal> {
    const [fonts, tokens] = await Promise.all([faces.Faces.read(root), Tokens.read(root)])

    return new Seal(fonts, tokens)
  }

  constructor(fonts: faces.Faces, tokens: Tokens) {
    this.#faces  = fonts
    this.#tokens = tokens
    this.marks   = { ...this.#rim(), ...this.#forecast(SampleDay.record().window.irradiances) }
  }

  /**
   * Draws the README's plaque in `scheme`, the seal over the credit's heading,
   * its lede broken after its comma, and a short rule.
   */
  plaque(scheme: Scheme): VNode {
    const { heading, height, lede, rule, width } = PLAQUE

    const paint  = (color: drawing.SealColor | 'muted') => this.#tokens.color(`--color-${color}`, scheme)
    const middle = width / 2
    const say    = (
      text  : string,
      voice : faces.Voice,
      color : 'ink' | 'muted',
      at    : Pick<faces.Saying, 'size' | 'y'>
    ) => this.#faces.say(text, voice, { ...at, anchor: 'middle', fill: paint(color), x: middle })

    return h('svg', {
      'aria-label' : credit.creditLabel(),
      height       : height,
      role         : 'img',
      viewBox      : `0 0 ${width} ${height}`,
      width        : width,
      xmlns        : SVG_NAMESPACE
    }, [
      h('g', { transform: `translate(${middle - drawing.SEAL.size / 2} 0)` }, drawing.sealDrawing(
        `seal-sun-${scheme}`, this.marks, paint
      )),
      say(credit.CREDIT.heading, faces.DISPLAY, 'ink', heading),
      ...credit.CREDIT.lede.split(/(?<=,) /).map((line, index) =>
        say(line, LEDE, 'muted', { size: lede.size, y: lede.y[index]! })
      ),
      h('path', {
        d              : [-1, 1].map((side) => {
          const near = middle + side * rule.gap

          return `M${near} ${rule.y}H${near + side * rule.length}`
        }).join(''),
        stroke         : paint('accent'),
        'stroke-width' : rule.stroke
      }),
      h('circle', { cx: middle, cy: rule.y, fill: paint('accent'), r: rule.dot })
    ])
  }

  /**
   * Places a ray for each step of the forecast across the half sun's upper
   * half, the morning's first step on the left, each as long as its share of
   * the brightest step and a step with no sunlight a dot.
   */
  #forecast(irradiances: readonly number[]): Pick<drawing.SealMarks, 'calm' | 'rays'> {
    const { center, rays, sun } = drawing.SEAL

    const brightest = max(irradiances)!
    const at        = (angle: number, radius: number) =>
      [tenth(center + radius * Math.cos(angle)), tenth(sun.y - radius * Math.sin(angle))] as const
    const steps     = irradiances.map((irradiance, index) => ({
      angle : Math.PI * (1 - (index + 0.5) / irradiances.length),
      reach : rays.length * irradiance / brightest
    }))

    return {
      calm : steps.filter(({ reach }) => reach === 0).map(({ angle }) => at(angle, rays.inner)),
      rays : steps.filter(({ reach }) => reach > 0).map(({ angle, reach }) =>
        `M${at(angle, rays.inner).join(' ')}L${at(angle, rays.inner + reach).join(' ')}`
      )
    }
  }

  /**
   * Letters the rim's two arcs in the mono face, each letter upright and
   * centered on its own angle, the top arc read outward from the center and
   * the bottom arc inward, with a dot midway in each gap between them.
   */
  #rim(): Pick<drawing.SealMarks, 'gaps' | 'rim'> {
    const { center, rim } = drawing.SEAL

    const { bottom, top } = credit.creditRim()
    const arc             = (text: string, baseline: number, turn: number) =>
      Array.from(text).flatMap((letter, index) => {
        if (letter === ' ') return []

        const setting = this.#faces.set(faces.MONO, rim.size, letter)
        const offset  = (index - (text.length - 1) / 2) * rim.step
        const angle   = turn * Math.sign(offset) * tenth(Math.abs(offset))

        return [{
          d         : setting.d,
          transform : `translate(${center} ${center}) rotate(${angle}) `
                    + setting.transformAt(-setting.width / 2, baseline)
        }]
      })
    const middle = (rim.inner + rim.outer) / 2
    const gap    = (90 + (top.length - bottom.length) * rim.step / 4) * Math.PI / 180

    return {
      gaps : [1, -1].map((side) =>
        [tenth(center + side * middle * Math.sin(gap)), tenth(center - middle * Math.cos(gap))] as const
      ),
      rim  : [...arc(top, -rim.inner, 1), ...arc(bottom, rim.outer, -1)]
    }
  }
}

/**
 * Names the file the plaque's form in `scheme` is served from, beneath the
 * site's root.
 */
export function plaqueAddress(scheme: Scheme): string {
  return `/readme/credit-${scheme}.svg`
}
