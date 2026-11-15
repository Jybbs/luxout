import { type VNode, defineComponent, shallowRef, useId } from 'vue'

import { data }                  from '../../../lib/identity/identity.data.ts'
import type { Scheme }           from '../../../lib/theme/tokens.ts'
import { layers }                from '../../controls/layers.tsx'
import { Tablist, tabPanel }     from '../../controls/tablist.tsx'
import { GROUND, INK, onGround } from './grounds.tsx'

/**
 * A color of the palette as the identity reader lists it.
 */
type Swatch = (typeof data.colors)[number]

const COLORS = data.colors
/**
 * The two schemes in the order a cell sets their grounds out, light first.
 */
const SHOWN = ['light', 'dark'] as const satisfies readonly Scheme[]

/**
 * The palette as one strip of bands, the picked band widening to name itself
 * in whichever ground's ink reads on it, over the color's meaning and a cell
 * per ground drawing it in the use it admits there.
 */
export const PaletteBands = defineComponent({
  name: 'PaletteBands',
  setup() {
    const id       = useId()
    const selected = shallowRef(0)

    return () => (
      <div class="widget palette-bands grid gap-3">
        <Tablist
          classes={{
            list : 'flex h-18 overflow-hidden rounded-md ring-1 ring-rule',
            tab  : [
              'group/band relative min-w-0 basis-0 grow cursor-pointer overflow-hidden border-0 p-0',
              'text-left',
              'transition-[flex-grow] duration-(--timing-settle) data-selected:grow-[7]',
              'focus-visible:-outline-offset-2'
            ]
          }}
          id={id}
          label="Palette"
          onSelect={(index: number) => { selected.value = index }}
          selected={selected.value}
          tabs={COLORS.map((swatch) => ({
            label : swatch.name,
            style : { background: `var(${swatch.token})`, color: inkOn(swatch) }
          }))}
        >
          {{
            default: ({ index }: { index: number }) => [
              <span
                class={[
                  'absolute inset-x-2.5 bottom-2 grid gap-0.5 opacity-0 transition-opacity',
                  'duration-(--timing-fade) group-data-selected/band:opacity-100'
                ]}
              >
                <b
                  class={[
                    'font-display text-[0.92rem]/[1.1] font-semibold whitespace-nowrap',
                    '@max-[20rem]:whitespace-normal @sm:text-[1.05rem]/[1.1]'
                  ]}
                >
                  {COLORS[index]!.name}
                </b>
                <span class="widget-num text-[0.66rem]/none tracking-[0.06em] uppercase">
                  {COLORS[index]!.hex}
                </span>
              </span>
            ]
          }}
        </Tablist>
        <div {...tabPanel(id, selected.value)} class="min-w-0">
          {layers(COLORS.map((swatch) => (
            <div class="grid gap-3 @md:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] @md:gap-5">
              {named(swatch)}
              <div class="grid grid-cols-2 gap-2 @md:grid-cols-1">
                {...SHOWN.map((scheme) => cell(swatch, scheme))}
              </div>
            </div>
          )), selected.value)}
        </div>
      </div>
    )
  }
})

/**
 * One ground's cell: the color drawn in its use there, the ground's name, and
 * the use beside the ratio.
 */
function cell(swatch: Swatch, scheme: Scheme): VNode {
  return (
    <div
      class={['grid grid-cols-[48px_minmax(0,1fr)] items-center gap-x-2.5 rounded-md px-2.5 py-2', 'ring-1 ring-rule']}
      style={onGround(scheme)}
    >
      <span class="row-span-2 grid place-items-center">{glyphOf(swatch, scheme)}</span>
      <span class="font-mono text-[0.62rem]/[1.3] font-medium tracking-[0.08em] uppercase">
        On {GROUND[scheme].name}
      </span>
      <span class="widget-num text-[0.78rem]/[1.3] uppercase">
        {swatch.use[scheme]} {swatch.contrast[scheme].toFixed(2)}
      </span>
    </div>
  )
}

/**
 * Draws `swatch` on `scheme`'s ground in the use its contrast there admits:
 * letters as text, a stroke and a dot as a mark, or a block under the ground's
 * ink edge as a fill.
 */
function glyphOf(swatch: Swatch, scheme: Scheme): VNode {
  const paint = `var(${swatch.token})`

  switch (swatch.use[scheme]) {
    case 'text':
      return (
        <span aria-hidden class="font-display text-[1.6rem]/none font-semibold" style={{ color: paint }}>
          Aa
        </span>
      )
    case 'mark':
      return (
        <svg aria-hidden class="h-5 w-12" viewBox="0 0 36 14">
          <path
            d="M2 11C10 11 14 3 22 3H34"
            fill="none"
            stroke={paint}
            stroke-linecap="round"
            stroke-width={2.4}
          />
          <circle cx={22} cy={3} fill={paint} r={2.6} />
        </svg>
      )
    case 'fill':
      return (
        <span
          aria-hidden
          class="block h-5 w-12 rounded-[2px] border"
          style={{ background: paint, borderColor: `var(${INK[scheme]})` }}
        />
      )
  }
}

/**
 * The ground whose ink reads best set on `swatch`, which carries the words a
 * band writes on the color itself.
 */
function inkOn(swatch: Swatch): string {
  return `var(${GROUND[swatch.contrast.dark >= swatch.contrast.light ? 'dark' : 'light'].token})`
}

/**
 * A color's name, its hex and token in capitals, and its meaning.
 */
function named(swatch: Swatch): VNode {
  return (
    <div class="grid min-w-0 content-start gap-1">
      <b class="font-display text-[1.3rem]/[1.1] font-semibold">{swatch.name}</b>
      <span class="widget-caps text-ink">{swatch.hex} · {swatch.token}</span>
      <span class="text-[0.9rem]/[1.4] text-ink">{swatch.meaning}</span>
    </div>
  )
}
