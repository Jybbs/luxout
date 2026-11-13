import { type VNode, defineComponent, h, shallowRef, useId } from 'vue'

import type { DebugField, FieldKey } from '../../../lib/troubleshooting/debug-line.ts'
import { data }                      from '../../../lib/troubleshooting/debug-line.data.ts'
import { layers }                    from '../../controls/layers.ts'
import { Tablist, tabPanel }         from '../../controls/tablist.ts'

import './styles/debug-line.css'

const { fields, line } = data

const SPANS: Partial<Record<FieldKey, string>> = { stamp: 'span 2', steps: '1 / -1' }
const opening                                  = fields.findIndex(({ key }) => key === 'reading')
const tabs                                     = fields.map(({ key, name, value }) => ({
  label : `${name}, ${value}`,
  style : { 'grid-column': SPANS[key] ?? 'auto' }
}))

/**
 * Sets a tile per field of the debug line beneath the line as the Homebridge
 * log prints it, each tile a tab in the hue its quantity takes, and the chosen
 * tile's note in a callout beside a map of the tiles marking where it sits.
 */
export const DebugLine = defineComponent({
  name: 'DebugLine',
  setup() {
    const id       = useId()
    const selected = shallowRef(opening)

    return () => {
      const chosen = fields[selected.value]!

      return h('div', { class: 'widget debug-line' }, h('div', { class: 'debug-line-log' }, [
        h('div', { class: 'debug-line-bar' }, h('span', { class: 'widget-caps' }, 'Homebridge log')),
        h('p', { 'aria-hidden': true, class: 'debug-line-raw' }, line),
        h('p', { class: 'visually-hidden' }, `The line reads ${line}`),
        h(
          Tablist,
          {
            id       : id,
            label    : 'Fields of the debug line',
            name     : 'debug-line',
            onSelect : (index: number) => selected.value = index,
            selected : selected.value,
            tabs     : tabs
          },
          { default: ({ index }: { index: number }) => tile(fields[index]!) }
        ),
        h('div', { class: 'debug-line-callout', 'data-hue': chosen.hue }, [
          h('div', { 'aria-hidden': true, class: 'debug-line-map' }, tabs.map(({ style }, index) =>
            h('i', { class: ['debug-line-cell', { on: index === selected.value }], style })
          )),
          h(
            'div',
            { ...tabPanel(id, selected.value), class: 'debug-line-notes' },
            layers(fields.map(({ note }) => h('p', note)), selected.value)
          )
        ])
      ]))
    }
  }
})

function tile({ hue, name, value }: DebugField): VNode {
  return h('span', { class: 'debug-line-tile', 'data-hue': hue }, [
    h('span', { 'aria-hidden': true, class: 'debug-line-word widget-caps' }, name),
    h('span', { 'aria-hidden': true, class: 'debug-line-value widget-num' }, value)
  ])
}
