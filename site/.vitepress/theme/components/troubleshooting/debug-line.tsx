import { type VNode, defineComponent, shallowRef, useId } from 'vue'

import type { DebugField, FieldKey } from '../../../lib/troubleshooting/debug-line.ts'
import { data }                      from '../../../lib/troubleshooting/debug-line.data.ts'
import { layers }                    from '../../controls/layers.tsx'
import { Tablist, tabPanel }         from '../../controls/tablist.tsx'

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

      return (
        <div class="widget debug-line">
          <div class="debug-line-log">
            <div class="debug-line-bar"><span class="widget-caps">Homebridge log</span></div>
            <p aria-hidden class="debug-line-raw">{line}</p>
            <p class="visually-hidden">{`The line reads ${line}`}</p>
            <Tablist
              id={id}
              label="Fields of the debug line"
              name="debug-line"
              onSelect={(index: number) => selected.value = index}
              selected={selected.value}
              tabs={tabs}
            >
              {{ default: ({ index }: { index: number }) => tile(fields[index]!) }}
            </Tablist>
            <div class="debug-line-callout" data-hue={chosen.hue}>
              <div aria-hidden class="debug-line-map">
                {...tabs.map(({ style }, index) => (
                  <i class={['debug-line-cell', { on: index === selected.value }]} style={style} />
                ))}
              </div>
              <div {...tabPanel(id, selected.value)} class="debug-line-notes">
                {layers(fields.map(({ note }) => <p>{note}</p>), selected.value)}
              </div>
            </div>
          </div>
        </div>
      )
    }
  }
})

function tile({ hue, name, value }: DebugField): VNode {
  return (
    <span class="debug-line-tile" data-hue={hue}>
      <span aria-hidden class="debug-line-word widget-caps">{name}</span>
      <span aria-hidden class="debug-line-value widget-num">{value}</span>
    </span>
  )
}
