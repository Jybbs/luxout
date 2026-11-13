import { defineComponent } from 'vue'

import './styles/table-fold.css'

/**
 * Folds shut, beneath a widget, the table the widget stands in for, leaving the
 * table in the page for search and for a reader without scripts.
 */
export const TableFold = defineComponent({
  name  : 'TableFold',
  props : { summary: { required: true, type: String } },
  setup(props, { slots }) {
    return () => (
      <details class="table-fold">
        <summary>{props.summary}</summary>
        {slots.default?.()}
      </details>
    )
  }
})
