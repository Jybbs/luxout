import { type VNode, defineComponent, h, shallowRef, useId } from 'vue'

import { data }              from '../../../lib/daylight/daylight.data.ts'
import type { Decade }       from '../../../lib/daylight/lux-scale.ts'
import { layers }            from '../../controls/layers.ts'
import { Tablist, tabPanel } from '../../controls/tablist.ts'

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
    const tiles   = { default: ({ index }: { index: number }) => tile(decades[index]!) }

    return () => h('div', { class: 'widget lux-scale' }, [
      h('div', { class: 'lux-scale-words' }, slots.default?.()),
      h(
        Tablist,
        {
          id       : chooser.id,
          label    : 'Decades of lux',
          name     : 'lux-scale',
          onSelect : chooser.select,
          selected : chooser.chosen.value,
          tabs     : tabs
        },
        tiles
      ),
      h('div', tabPanel(chooser.id, chooser.chosen.value), layers(decades.map(layer), chooser.chosen.value))
    ])
  }
})

function layer({ clearSky, day, everyday, range }: Decade): VNode {
  return h('div', { class: 'lux-scale-body' }, [
    h('span', { class: 'lux-scale-range' }, range),
    h('dl', { class: 'lux-scale-rows' }, [
      h('dt', { class: 'widget-caps' }, 'Everyday light'),
      h('dd', everyday.flatMap(({ lux, name }, index) => [index ? ', ' : '', h('em', name), ` at ${lux}`])),
      h('dt', { class: 'widget-caps' }, 'Clear sky'),
      h('dd', clearSky),
      h('dt', { class: 'widget-caps' }, date),
      h('dd', day)
    ])
  ])
}

function tile({ floor, minutes }: Decade): VNode[] {
  return [
    h('span', { class: 'lux-scale-floor' }, floor),
    h('span', { class: 'lux-scale-minutes' }, [
      h('b', minutes),
      h('span', { class: 'lux-scale-unit' }, 'minutes')
    ])
  ]
}
