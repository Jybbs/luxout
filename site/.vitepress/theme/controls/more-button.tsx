import type { VNode } from 'vue'

const MARK = [
  'before:absolute before:inset-x-0 before:top-[4.25px] before:h-[1.5px] before:rounded-[1px]',
  'before:bg-current after:absolute after:inset-x-0 after:top-[4.25px] after:h-[1.5px]',
  'after:rounded-[1px] after:bg-current after:rotate-90 after:transition-[rotate]',
  'after:duration-(--timing-move) group-aria-expanded:after:rotate-180'
]

/**
 * Draws a disclosure button, a plus whose upright folds into a minus as the
 * region `controls` opens, per the ARIA disclosure pattern, with `fit` adding
 * the utilities the widget around it lays the button out with.
 */
export function moreButton(
  controls : string,
  label    : string,
  open     : boolean,
  toggle   : () => void,
  fit      : string = ''
): VNode {
  return (
    <button
      aria-controls={controls}
      aria-expanded={open}
      class={[
        'group inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-rule bg-raised',
        'py-1 pr-2.5 pl-2 font-mono text-[0.64rem]/[1.4] font-semibold tracking-widest whitespace-nowrap',
        'text-ink uppercase',
        fit
      ]}
      onClick={toggle}
      type="button"
    >
      <span aria-hidden class={['relative size-2.5 flex-none', ...MARK]} />
      {label}
    </button>
  )
}
