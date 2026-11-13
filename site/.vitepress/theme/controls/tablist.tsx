import { useTimeoutFn }                   from '@vueuse/core'
import { type PropType, defineComponent } from 'vue'

import { PAUSES }   from '../../lib/motion/timing.ts'
import { FocusRow } from './focus-row.ts'

/**
 * One tab, its accessible name beside the inline style its surface takes.
 */
interface Tab {
  readonly label  : string
  readonly style? : Readonly<Record<string, string>>
}

/**
 * Moves one selection across a row of tabs per the ARIA tabs pattern, selecting
 * on a click, on the arrow keys, Home, and End, and on a mouse resting on a tab
 * for the dwell pause.
 */
export const Tablist = defineComponent({
  emits : ['select'],
  name  : 'Tablist',

  props: {
    id       : { required: true, type: String },
    label    : { required: true, type: String },
    name     : { required: true, type: String },
    selected : { required: true, type: Number },
    tabs     : { required: true, type: Array as PropType<readonly Tab[]> }
  },

  setup(props, { emit, slots }) {
    const select = (index: number) => emit('select', index)
    const dwell  = useTimeoutFn(select, PAUSES.dwell, { immediate: false })
    const focus  = new FocusRow('ArrowRight', 'ArrowLeft', select)
    const rest   = (event: PointerEvent, index: number) => {
      if (event.pointerType === 'mouse') dwell.start(index)
    }

    return () => (
      <div aria-label={props.label} class={`${props.name}-tabs`} role="tablist">
        {...props.tabs.map(({ label, style }, index) => (
          <button
            aria-controls={panelId(props.id)}
            aria-label={label}
            aria-selected={index === props.selected}
            class={`${props.name}-tab`}
            id={tabId(props.id, index)}
            onClick={() => select(index)}
            onKeydown={(event) => focus.move(event, index)}
            onPointerenter={(event) => rest(event, index)}
            onPointerleave={dwell.stop}
            ref={(element) => focus.keep(element, index)}
            role="tab"
            style={style}
            tabindex={index === props.selected ? 0 : -1}
            type="button"
          >
            {...(slots.default?.({ index }) ?? [])}
          </button>
        ))}
      </div>
    )
  }
})

/**
 * Writes the id of the panel the tablist `id` controls.
 */
export function panelId(id: string): string {
  return `${id}-panel`
}

/**
 * Writes the id of the tab at `index` in the tablist `id`.
 */
export function tabId(id: string, index: number): string {
  return `${id}-tab-${index}`
}

/**
 * Writes the attributes of the panel the tablist `id` controls, labeled by the
 * tab at `selected`.
 */
export function tabPanel(id: string, selected: number): Readonly<Record<string, number | string>> {
  return { 'aria-labelledby': tabId(id, selected), id: panelId(id), role: 'tabpanel', tabindex: 0 }
}
