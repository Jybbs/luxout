import * as collapsible               from '@zag-js/collapsible'
import { normalizeProps, useMachine } from '@zag-js/vue'
import { type ComputedRef, type ShallowRef, type VNode, computed, useId } from 'vue'

const MARK = [
  'before:absolute before:inset-x-0 before:top-[4.25px] before:h-[1.5px] before:rounded-[1px]',
  'before:bg-current after:absolute after:inset-x-0 after:top-[4.25px] after:h-[1.5px]',
  'after:rounded-[1px] after:bg-current after:rotate-90 after:transition-[rotate]',
  'after:duration-(--timing-move) group-data-[state=open]:after:rotate-180'
]

/**
 * Opens and closes the region whose id is `region` on Zag's collapsible
 * machine, per the ARIA disclosure pattern. The region's own layers show it
 * while `open` holds, and `toggle` flips it.
 */
export class Disclosure {
  readonly #api: ComputedRef<collapsible.Api>

  constructor(region: string, open: Readonly<ShallowRef<boolean>>, toggle: () => void) {
    const id      = useId()
    const service = useMachine(collapsible.machine, computed(() => ({
      id           : id,
      ids          : { content: region },
      onOpenChange : () => toggle(),
      open         : open.value
    })))

    this.#api = computed(() => collapsible.connect(service, normalizeProps))
  }

  /**
   * Reads the props a button takes to open and close the region, for a widget
   * drawing a button of its own.
   */
  get trigger(): ReturnType<collapsible.Api['getTriggerProps']> {
    return this.#api.value.getTriggerProps()
  }

  /**
   * Draws the button, a plus whose upright folds into a minus as the region
   * opens, with `fit` adding the utilities the widget around it lays the button
   * out with.
   */
  button(label: string, fit = ''): VNode {
    return (
      <button
        {...this.trigger}
        class={[
          'group inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-rule bg-raised',
          'py-1 pr-2.5 pl-2 font-mono text-[0.64rem]/[1.4] font-semibold tracking-widest whitespace-nowrap',
          'text-ink uppercase',
          fit
        ]}
      >
        <span aria-hidden class={['relative size-2.5 flex-none', ...MARK]} />
        {label}
      </button>
    )
  }
}
