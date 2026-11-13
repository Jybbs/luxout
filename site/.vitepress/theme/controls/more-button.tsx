import type { VNode } from 'vue'

/**
 * Draws a disclosure button, a plus whose upright folds into a minus as the
 * region `controls` opens, per the ARIA disclosure pattern.
 */
export function moreButton(controls: string, label: string, open: boolean, toggle: () => void): VNode {
  return (
    <button aria-controls={controls} aria-expanded={open} class="widget-more" onClick={toggle} type="button">
      <span aria-hidden class="widget-more-mark" />
      {label}
    </button>
  )
}
