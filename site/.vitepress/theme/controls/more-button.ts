import { type VNode, h } from 'vue'

/**
 * Draws a disclosure button, a plus whose upright folds into a minus as the
 * region `controls` opens, per the ARIA disclosure pattern.
 */
export function moreButton(controls: string, label: string, open: boolean, toggle: () => void): VNode {
  return h(
    'button',
    {
      'aria-controls' : controls,
      'aria-expanded' : open,
      class           : 'widget-more',
      onClick         : toggle,
      type            : 'button'
    },
    [h('span', { 'aria-hidden': true, class: 'widget-more-mark' }), label]
  )
}
