import { type VNode, defineComponent, shallowRef, useId } from 'vue'

import { data }              from '../../../lib/daylight/daylight.data.ts'
import type { Decade }       from '../../../lib/daylight/lux-scale.ts'
import { layers }            from '../../controls/layers.tsx'
import { Tablist, tabPanel } from '../../controls/tablist.tsx'

import './styles/lux-scale.css'

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
      <div class="widget lux-scale">
        <div class="lux-scale-words">{...(slots.default?.() ?? [])}</div>
        <Tablist
          id={chooser.id}
          label="Decades of lux"
          name="lux-scale"
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
    <div class="lux-scale-body">
      <span class="lux-scale-range">{range}</span>
      <dl class="lux-scale-rows">
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
    <span class="lux-scale-floor">{floor}</span>,
    <span class="lux-scale-minutes">
      <b>{minutes}</b>
      <span class="lux-scale-unit">minutes</span>
    </span>
  ]
}
