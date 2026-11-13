import { defineComponent } from 'vue'

/**
 * Folds shut, beneath a widget, the table the widget stands in for, leaving the
 * table in the page for search and for a reader without scripts.
 */
export const TableFold = defineComponent({
  name  : 'TableFold',
  props : { summary: { required: true, type: String } },
  setup(props, { slots }) {
    return () => (
      <details class="mt-3 text-[0.875rem] text-muted">
        <summary
          class={[
            'cursor-pointer transition-colors duration-(--timing-hover) hover:text-ink',
            'focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2',
            'focus-visible:outline-accent'
          ]}
        >
          {props.summary}
        </summary>
        {slots.default?.()}
      </details>
    )
  }
})
