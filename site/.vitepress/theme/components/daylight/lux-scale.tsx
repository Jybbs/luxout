import { type VNode, defineComponent, shallowRef, useId } from 'vue'

import { data }              from '../../../lib/daylight/daylight.data.ts'
import type { Decade }       from '../../../lib/daylight/lux-scale.ts'
import { layers }            from '../../controls/layers.tsx'
import { Tablist, tabPanel } from '../../controls/tablist.tsx'

/**
 * The utilities the row of tiles and each tile take, a tile rising as it is
 * selected.
 */
const CLASSES = {
  list: [
    'grid grid-cols-9 gap-0.75',
    '@max-sm:grid-cols-[minmax(0,1.3fr)_repeat(7,minmax(0,1fr))_minmax(0,1.3fr)]'
  ],

  tab: [
    'group flex h-14.5 flex-col items-start justify-between rounded-md px-1.5 pt-1.5 pb-1.75 text-left',
    'font-mono text-[0.625rem]/none font-medium tabular-nums',
    'transition-[translate,box-shadow] [transition-duration:var(--timing-move),var(--timing-hover)]',
    'focus-visible:outline-offset-2 data-selected:-translate-y-0.75',
    'data-selected:shadow-[inset_0_0_0_2px_var(--color-ink),inset_0_0_0_3.5px_var(--color-ground)]',
    '@max-md:h-12.5 @max-md:items-center @max-md:px-0 @max-md:pt-1.25 @max-md:pb-1.5'
  ]
}

const { date, decades, opening } = data.luxScale
const tabs                       = decades.map(({ fill, ink, label }) => ({
  label : label,
  style : { background: fill, color: ink }
}))

/**
 * Holds the decade a reader has chosen.
 */
class Chooser {
  readonly chosen = shallowRef(opening)
  readonly id     = useId()

  readonly select = (index: number): void => {
    this.chosen.value = index
  }
}

/**
 * Sets a tile for each decade of the range `CurrentAmbientLightLevel` accepts,
 * shaded from dark to bright with the minutes the sample day's reading spends
 * in it, above a panel on the chosen decade's everyday light, the sun's
 * altitude, and the times of the day.
 */
export const LuxScale = defineComponent({
  name: 'LuxScale',
  setup(_, { slots }) {
    const chooser = new Chooser()

    return () => (
      <div class="widget lux-scale grid gap-3">
        <div
          class={[
            'lux-scale-words [&_p]:m-0 [&_p]:text-lg/[1.5] [&_p]:text-pretty',
            '@max-md:[&_p]:text-[1.04rem]'
          ]}
        >
          {...(slots.default?.() ?? [])}
        </div>
        <Tablist
          classes={CLASSES}
          id={chooser.id}
          label="Decades of lux"
          onSelect={chooser.select}
          selected={chooser.chosen.value}
          tabs={tabs}
        >
          {{ default: ({ index }: { index: number }) => tile(decades[index]!) }}
        </Tablist>
        <div {...tabPanel(chooser.id, chooser.chosen.value)}>
          {layers(decades.map(layer), chooser.chosen.value)}
        </div>
      </div>
    )
  }
})

function layer({ clearSky, day, everyday, range }: Decade): VNode {
  return (
    <div class="grid content-start gap-2">
      <span
        class={[
          'lux-scale-range font-display text-xl/[1.1] font-semibold whitespace-nowrap',
          'lining-nums tabular-nums'
        ]}
      >
        {range}
      </span>
      <dl
        class={[
          'm-0 grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1.25',
          '[&>dt]:whitespace-nowrap [&>dd]:m-0 [&>dd]:text-[0.88rem]/[1.4]',
          '@max-md:grid-cols-1 @max-md:gap-0.5 @max-md:[&>dd]:mb-1.5'
        ]}
      >
        <dt class="widget-caps">Everyday light</dt>
        <dd>
          {...everyday.flatMap(({ lux, name }, index) => [index ? ', ' : '', <em>{name}</em>, ` at ${lux}`])}
        </dd>
        <dt class="widget-caps">Clear sky</dt>
        <dd>{clearSky}</dd>
        <dt class="widget-caps">{date}</dt>
        <dd>{day}</dd>
      </dl>
    </div>
  )
}

function tile({ floor, minutes }: Decade): VNode[] {
  return [
    <span class="@max-md:group-even:invisible">{floor}</span>,
    <span class="grid gap-0.5">
      <b class="font-display text-[0.95rem]/none font-semibold lining-nums tabular-nums">{minutes}</b>
      <span class="@max-md:hidden">minutes</span>
    </span>
  ]
}
