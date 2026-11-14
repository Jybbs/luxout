import * as tabs                                    from '@zag-js/tabs'
import { mergeProps, normalizeProps, useMachine }   from '@zag-js/vue'
import { type PropType, computed, defineComponent } from 'vue'

import { Pauses } from './pauses.ts'

/**
 * The utilities the tablist and each of its tabs take.
 */
interface Classes {
  readonly list : string | readonly string[]
  readonly tab  : string | readonly string[]
}

/**
 * One tab, its accessible name beside the inline style its surface takes.
 */
interface Tab {
  readonly label  : string
  readonly style? : Readonly<Record<string, string>>
}

/**
 * Moves one selection across a row of tabs on Zag's tabs machine, which selects
 * a tab on a click and as the arrow keys, Home, and End move the focus onto it,
 * the focus looping at each end. The tablist adds a mouse resting on a tab for
 * the dwell pause selecting it.
 */
export const Tablist = defineComponent({
  emits : ['select'],
  name  : 'Tablist',

  props: {
    classes  : { required: true, type: Object as PropType<Classes> },
    id       : { required: true, type: String },
    label    : { required: true, type: String },
    selected : { required: true, type: Number },
    tabs     : { required: true, type: Array as PropType<readonly Tab[]> }
  },

  setup(props, { emit, slots }) {
    const select  = (index: number) => emit('select', index)
    const pauses  = new Pauses(select)
    const service = useMachine(tabs.machine, computed(() => ({
      ...tabsContext(props.id, props.label),
      onValueChange : ({ value }: tabs.ValueChangeDetails) => select(Number(value)),
      value         : String(props.selected)
    })))
    const api  = computed(() => tabs.connect(service, normalizeProps))
    const rest = (event: PointerEvent, index: number) => {
      if (event.pointerType === 'mouse') pauses.dwell.start(index)
    }

    return () => (
      <div {...api.value.getListProps()} class={props.classes.list}>
        {...props.tabs.map(({ label, style }, index) => (
          <button
            {...mergeProps(api.value.getTriggerProps({ value: String(index) }), {
              onPointerenter : (event: PointerEvent) => rest(event, index),
              onPointerleave : pauses.dwell.stop
            })}
            aria-label={label}
            class={props.classes.tab}
            style={style}
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
function panelId(id: string): string {
  return `${id}-panel`
}

/**
 * Writes the id of the tab at `index` in the tablist `id`.
 */
function tabId(id: string, index: number): string {
  return `${id}-tab-${index}`
}

/**
 * Writes the attributes of the panel the tablist `id` controls, labeled by the
 * tab at `selected`.
 */
export function tabPanel(id: string, selected: number): Readonly<Record<string, number | string>> {
  return { 'aria-labelledby': tabId(id, selected), id: panelId(id), role: 'tabpanel', tabindex: 0 }
}

/**
 * Builds the context Zag's tabs machine takes for the tablist `id` named
 * `label`, selecting a tab as the focus lands on it and looping the focus at
 * each end.
 */
export function tabsContext(id: string, label: string) {
  return {
    activationMode : 'automatic' as const,
    id             : id,
    ids            : { content: () => panelId(id), trigger: (value: string) => tabId(id, Number(value)) },
    loopFocus      : true,
    translations   : { listLabel: label }
  }
}
