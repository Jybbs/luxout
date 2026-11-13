import type { VNode } from 'vue'

/**
 * Stacks `children` in one grid cell, showing the one at `selected` and marking
 * the rest `inert`, so a widget keeps the height of its tallest layer.
 */
export function layers(children: readonly VNode[], selected: number): VNode {
  return (
    <div class="layers grid min-w-0">
      {...children.map((child, index) => {
        const shown = index === selected

        return (
          <div
            class={[
              'layer col-start-1 row-start-1 min-w-0 transition-opacity duration-(--timing-fade)',
              shown ? 'shown opacity-100' : 'opacity-0'
            ]}
            inert={!shown}
          >
            {child}
          </div>
        )
      })}
    </div>
  )
}
