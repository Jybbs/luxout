import * as toggle                              from '@zag-js/toggle'
import { normalizeProps, useMachine }           from '@zag-js/vue'
import { type VNode, computed, defineComponent, shallowRef, useId } from 'vue'

import { data }              from '../../../lib/identity/identity.data.ts'
import type { Scheme }       from '../../../lib/theme/tokens.ts'
import { PlotSlider }        from '../../controls/plot-slider.tsx'
import { GROUND, onGround }  from './grounds.tsx'

const { construction, svgs } = data.logo
/**
 * The color the construction is drawn in on each ground, Ube, which carries
 * the sun's geometry across the site.
 */
const GEOMETRY = 'var(--luxout-accent-3)'
/**
 * The sizes the mark is shown at on each ground, the sizes a browser draws a
 * favicon at in a tab, a bookmark, and a shortcut.
 */
const SIZES = [16, 32, 48] as const
/**
 * The parts of the title's construction, read back from the title the site
 * serves: its frame, the sun's center and the glow's radius from the glow's
 * gradient, and the horizon's two stretches on either side of the break.
 */
const TITLE = (() => {
  const svg     = svgs.title.light
  const numbers = (tag: string) => [...svg.matchAll(new RegExp(`<${tag} ([^>]*)>`, 'g'))].map(
    ([, attributes]) => Object.fromEntries(
      [...attributes!.matchAll(/([\w-]+)="(-?[\d.]+)"/g)].map(([, name, value]) => [name, Number(value)])
    )
  )
  const [left, top, width, height] = /viewBox="([^"]+)"/.exec(svg)![1]!.split(' ').map(Number)
  const glow                       = numbers('radialGradient')[0]!
  const [before, after]            = numbers('rect').slice(-2)

  return {
    box     : { height: height!, left: left!, top: top!, width: width! },
    sun     : { cx: glow.cx!, cy: -glow.cy!, glow: glow.r!, r: glow.r! / construction.glow.radius },
    horizon : {
      from : before!.x!,
      gap  : [before!.x! + before!.width!, after!.x!] as const,
      to   : after!.x! + after!.width!
    }
  }
})()

/**
 * Holds the specimen's two settings: whether the construction lies over the
 * title, and how far the divider stands from Cararra toward Near Black, as a
 * share out of 100, beside whether the last move came from a key and so eases.
 */
class Grounds {
  readonly eased   = shallowRef(false)
  readonly id      = useId()
  readonly laid    = shallowRef(false)
  readonly layer   = computed(() => toggle.connect(this.#toggle, normalizeProps))
  readonly slider  : PlotSlider
  readonly toward  = shallowRef(50)
  readonly #toggle : toggle.Service

  constructor() {
    this.#toggle = useMachine(toggle.machine, computed(() => ({
      id              : this.id,
      onPressedChange : (pressed: boolean) => { this.laid.value = pressed },
      pressed         : this.laid.value
    })))
    this.slider = new PlotSlider({
      count : 101,
      label : `From ${GROUND.light.name} to ${GROUND.dark.name}`,
      page  : 25,
      set   : (value, eased) => {
        this.eased.value  = eased
        this.toward.value = value
      },
      text  : (value) => `${100 - value}% ${GROUND.light.name}, ${value}% ${GROUND.dark.name}`,
      value : () => this.toward.value
    })
  }

  /**
   * The switch laying the construction over the title, beside its key once
   * laid.
   */
  head(): VNode {
    return (
      <div class="flex min-h-7 flex-wrap items-center gap-x-4 gap-y-2">
        <button
          {...this.layer.value.getRootProps()}
          class={[
            'widget-pill cursor-pointer',
            'aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-ground'
          ]}
        >
          Construction
        </button>
        <div
          class={[
            'transition-opacity duration-(--timing-fade)',
            this.laid.value ? 'opacity-100' : 'opacity-0'
          ]}
          inert={!this.laid.value}
        >
          {key()}
        </div>
      </div>
    )
  }

  get motion(): string {
    return this.eased.value ? 'transition-[clip-path] duration-(--timing-move)' : ''
  }
}

/**
 * The title and the marks on both grounds at once, Near Black wiping across
 * Cararra from the left as a reader drags the divider or moves it by the
 * arrow keys, under the switch laying the construction over the title.
 */
export const LogoWipe = defineComponent({
  name: 'LogoWipe',
  setup() {
    const grounds = new Grounds()

    return () => {
      const at = grounds.toward.value

      return (
        <div class="widget logo-wipe grid gap-2.5">
          {grounds.head()}
          <div class="relative grid overflow-hidden rounded-md ring-1 ring-rule">
            <div class="col-start-1 row-start-1">{specimen('light', grounds.laid.value)}</div>
            <div
              class={['col-start-1 row-start-1', grounds.motion]}
              style={{ clipPath: `inset(0 ${100 - at}% 0 0)` }}
            >
              {specimen('dark', grounds.laid.value)}
            </div>
            {grounds.slider.render({
              at      : `${at}%`,
              control : 'absolute inset-0 cursor-ew-resize touch-pan-y',
              thumb   : [
                'absolute inset-y-0 w-0 border-l-2 border-l-(--luxout-accent-3) focus-visible:outline-none',
                'after:absolute after:top-1/2 after:-left-2.25 after:size-4 after:-translate-y-1/2',
                'after:rounded-full after:bg-(--luxout-accent-3) focus-visible:after:outline-2',
                'focus-visible:after:outline-offset-2 focus-visible:after:outline-accent',
                grounds.motion && 'transition-[left] duration-(--timing-move)'
              ]
            })}
          </div>
          {sizes()}
        </div>
      )
    }
  }
})

/**
 * Writes `svg` as the `data:` address an image's `src` reads.
 */
function inlined(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * The key to the construction, each part beside its measure in the o's
 * half-widths, as the construction declares it.
 */
function key(): VNode {
  const parts = [
    ['Horizon', `${Math.round(construction.horizon.opacity * 100)}% ink`],
    ['Break', `${construction.horizon.gap}× the o`],
    ['Glow', `${construction.glow.radius}× the o`]
  ]

  return (
    <ul class="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 *:m-0">
      {...parts.map(([name, measure]) => (
        <li class="widget-caps flex items-center gap-1.5 text-ink">
          <svg aria-hidden class="h-1 w-3.5" viewBox="0 0 14 4">
            <path d="M0 2H14" stroke={GEOMETRY} stroke-width={2.5} />
          </svg>
          <span>{name} {measure}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The construction laid over the title in its own units: the horizon running
 * the word, the break's two ends, the o's half-width, and the glow's reach
 * above the horizon, the only half of its circle the glow fills.
 */
function overlay(shown: boolean): VNode {
  const { box, horizon, sun } = TITLE

  return (
    <svg
      aria-hidden
      class={[
        'pointer-events-none absolute inset-0 size-full transition-opacity duration-(--timing-fade)',
        shown ? 'opacity-100' : 'opacity-0'
      ]}
      fill="none"
      stroke={GEOMETRY}
      viewBox={`${box.left} ${box.top} ${box.width} ${box.height}`}
    >
      <path
        d={`M${horizon.from} ${sun.cy}H${horizon.to}`}
        stroke-dasharray="4 4"
        stroke-width={1.5}
        vector-effect="non-scaling-stroke"
      />
      {...horizon.gap.map((x) => (
        <path
          d={`M${x} ${sun.cy - sun.r * 0.6}V${sun.cy + sun.r * 0.6}`}
          stroke-width={2}
          vector-effect="non-scaling-stroke"
        />
      ))}
      <circle
        cx={sun.cx}
        cy={sun.cy}
        r={sun.r}
        stroke-dasharray="2 3"
        stroke-width={1.5}
        vector-effect="non-scaling-stroke"
      />
      <path
        d={`M${sun.cx - sun.glow} ${sun.cy}A${sun.glow} ${sun.glow} 0 0 1 ${sun.cx + sun.glow} ${sun.cy}`}
        stroke-dasharray="6 4"
        stroke-width={1.5}
        vector-effect="non-scaling-stroke"
      />
    </svg>
  )
}

/**
 * Caption the sizes beneath a specimen, on the page's own ground.
 */
function sizes(): VNode {
  return <p class="widget-caps m-0 text-center">The mark at {SIZES.join(', ')} px</p>
}

/**
 * One ground's specimen: the title with the construction over it, then the
 * mark at each favicon size.
 */
function specimen(scheme: Scheme, shown: boolean): VNode {
  return (
    <div
      class={[
        'grid items-center justify-items-center gap-3 px-4 py-3',
        '@lg:grid-cols-[minmax(0,1fr)_auto] @lg:gap-8 @lg:pr-10'
      ]}
      style={onGround(scheme)}
    >
      <div class="relative w-full max-w-[26rem]">
        <img
          alt={`${construction.word.toLowerCase()}, the title on ${GROUND[scheme].name}`}
          class="block h-auto w-full"
          src={inlined(svgs.title[scheme])}
        />
        {overlay(shown)}
      </div>
      <div class="flex items-end gap-5 pb-2 @lg:flex-col @lg:items-center @lg:pb-0">
        {...SIZES.map((size) => (
          <img
            alt={`The mark at ${size} pixels`}
            height={size}
            src={inlined(svgs.mark[scheme])}
            width={size}
          />
        ))}
      </div>
    </div>
  )
}
