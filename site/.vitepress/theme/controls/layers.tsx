import type { VNode } from 'vue'

import './styles/layers.css'

/**
 * Stacks `children` in one grid cell, showing the one at `selected` and marking
 * the rest `inert`, so a widget keeps the height of its tallest layer.
 */
export function layers(children: readonly VNode[], selected: number): VNode {
  return (
    <div class="layers">
      {...children.map((child, index) => {
        const shown = index === selected

        return <div class={['layer', { shown }]} inert={!shown}>{child}</div>
      })}
    </div>
  )
}
