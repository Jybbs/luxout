import { useElementSize }             from '@vueuse/core'
import * as accordion                 from '@zag-js/accordion'
import { normalizeProps, useMachine } from '@zag-js/vue'
import { max, sum }                   from 'd3-array'
import { computed, defineComponent, onMounted, shallowRef, useId, watch } from 'vue'
import type { ComputedRef, VNode }    from 'vue'

import type { SettingRow } from '../../../lib/settings/rows.ts'
import { data as rows }    from '../../../lib/settings/settings.data.ts'

/**
 * The utilities a code span of the key's line takes, by the kind of token it
 * holds.
 */
const KINDS = {
  key         : 'font-mono text-[0.84rem]/[1.4] font-semibold whitespace-nowrap',
  number      : '',
  punctuation : 'text-muted',
  string      : 'whitespace-nowrap'
} satisfies Record<SettingRow['line'][number]['kind'], string>
/**
 * The utilities a code span of a row takes, overriding the page's inline-code
 * style.
 */
const ROW_CODE = 'bg-transparent p-0 font-mono text-inherit'

/**
 * Holds which row stands open on Zag's accordion machine, one row open at a
 * time and none closing on its own trigger, beside the list's height with its
 * tallest row open, so opening a shorter row moves nothing beneath the list.
 */
class Accordion {
  readonly list    = shallowRef<HTMLElement>()
  readonly tallest = shallowRef<number>()
  readonly #api: ComputedRef<accordion.Api>

  readonly #hold = (): void => {
    const list = this.list.value

    if (!list) return

    const items  = list.querySelectorAll('.settings-reference-item')
    const height = (element: Element) => element.getBoundingClientRect().height
    const part   = (item: Element, name: string) => height(item.querySelector(`.settings-reference-${name}`)!)
    const heads  = sum(items, (item) => height(item) - part(item, 'panel'))
    const most   = max(items, (item) => part(item, 'body'))!

    this.tallest.value = Math.ceil(heads + most)
  }

  constructor() {
    const service = useMachine(accordion.machine, {
      collapsible  : false,
      defaultValue : ['0'],
      id           : useId(),
      multiple     : false,
      orientation  : 'vertical'
    })

    this.#api = computed(() => accordion.connect(service, normalizeProps))

    watch(useElementSize(this.list).width, this.#hold)
    onMounted(() => void document.fonts.ready.then(this.#hold))
  }

  /**
   * The attributes the list spreads as the accordion's root, inside which the
   * machine finds each row's trigger.
   */
  get root() {
    return this.#api.value.getRootProps()
  }

  renderItem(index: number, row: SettingRow): VNode {
    const api                           = this.#api.value
    const value                         = String(index)
    const { expanded: open }            = api.getItemState({ value })
    const { hidden: _hidden, ...panel } = api.getItemContentProps({ value })

    return (
      <div
        {...api.getItemProps({ value })}
        class={[
          'settings-reference-item border-b border-rule transition-[background-color,box-shadow]',
          'duration-(--timing-fade) [&:has(+[data-state=open])]:border-transparent',
          'data-[state=open]:rounded-lg data-[state=open]:border-transparent data-[state=open]:bg-raised',
          'data-[state=open]:ring data-[state=open]:ring-rule',
          'data-[state=open]:shadow-[0_10px_24px_-20px_var(--color-shadow)]'
        ]}
      >
        <h3 class="m-0 border-0 p-0 [font:inherit] tracking-normal">
          <button
            {...api.getItemTriggerProps({ value })}
            aria-disabled={open || undefined}
            class={[
              'group grid w-full grid-cols-(--columns) items-baseline gap-x-(--gap) rounded-lg px-(--inset)',
              'py-2 text-left font-base text-[0.9rem]/[1.4] font-normal text-ink transition-colors',
              'duration-(--timing-hover) *:min-w-0 focus-visible:-outline-offset-2',
              'data-[state=closed]:hover:bg-ink/4 data-[state=open]:cursor-default'
            ]}
          >
            <code class={['settings-reference-key', ROW_CODE, KINDS.key]}>{row.key}</code>
            <span class="@max-md:hidden">{row.title}</span>
            <code class={[ROW_CODE, 'text-[0.8rem]/[1.4]']}>{row.type}</code>
            <code class={[ROW_CODE, 'text-[0.8rem]/[1.4] @max-md:hidden']}>{row.fallback}</code>
            <span
              aria-hidden
              class={[
                'relative size-2.5 self-center',
                'before:absolute before:inset-x-0 before:top-1 before:h-[1.5px] before:rounded-[1px]',
                'before:bg-muted after:absolute after:inset-x-0 after:top-1 after:h-[1.5px]',
                'after:rounded-[1px] after:bg-muted',
                'after:rotate-90 after:transition-[rotate] after:duration-(--timing-move)',
                'group-data-[state=open]:after:rotate-180'
              ]}
            />
          </button>
        </h3>
        <div
          {...panel}
          class={[
            'settings-reference-panel grid grid-rows-[0fr] transition-[grid-template-rows]',
            'duration-(--timing-settle) data-[state=open]:grid-rows-[1fr]'
          ]}
          inert={!open}
        >
          <div class="min-h-0 overflow-hidden">{body(row)}</div>
        </div>
      </div>
    )
  }
}

/**
 * Lays out every key of the platform block as one line of an accordion under a
 * header naming its columns, per the ARIA accordion pattern, with one row
 * always open as a card on what the key does, what happens without it, and its
 * line in the block.
 */
export const SettingsReference = defineComponent({
  name: 'SettingsReference',
  setup() {
    const accordion = new Accordion()

    return () => (
      <div
        class={[
          'widget settings-reference [--columns:var(--key)_minmax(0,1fr)_4.75rem_5.5rem_12px] [--gap:14px]',
          '[--inset:12px] [--key:11rem] @max-md:*:[--columns:minmax(0,1fr)_4.75rem_12px]',
          '@max-md:*:[--gap:10px] @max-md:*:[--inset:10px]'
        ]}
      >
        <div
          aria-hidden
          class={[
            'grid grid-cols-(--columns) items-baseline gap-x-(--gap) border-b border-ink/45 px-(--inset)',
            'pb-1.75',
            'font-mono text-[0.625rem]/[1.45] font-medium tracking-widest text-muted uppercase'
          ]}
        >
          <span>Key</span>
          <span class="@max-md:hidden">Title</span>
          <span>Type</span>
          <span class="@max-md:hidden">Default</span>
          <span />
        </div>
        <div
          {...accordion.root}
          class="settings-reference-list grid min-w-0 content-start"
          ref={accordion.list}
          style={accordion.tallest.value ? { minHeight: `${accordion.tallest.value}px` } : undefined}
        >
          {...rows.map((row, index) => accordion.renderItem(index, row))}
        </div>
      </div>
    )
  }
})

function body({ does, fallback, line, needed, title, without }: SettingRow): VNode {
  return (
    <div
      class={[
        'settings-reference-body grid gap-1.75 pr-(--inset) pb-3.5',
        'pl-[calc(var(--inset)+var(--key)+var(--gap))] @max-md:pl-(--inset)'
      ]}
    >
      <span class="settings-reference-narrow hidden text-[0.84rem] text-muted @max-md:block">
        {`${title} · default ${fallback}`}
      </span>
      <p class="m-0 text-[0.9rem]/[1.55]">{does}</p>
      <p class="widget-note">
        <span class="widget-caps">{needed ? 'Needed' : 'Optional'}</span>
        {` Without it, ${without}.`}
      </p>
      <code
        class={[
          'settings-reference-line max-w-full justify-self-start rounded-md bg-sunken px-2.5 py-1 font-mono',
          'text-[0.76rem]/[1.6] font-normal wrap-break-word whitespace-pre-wrap text-ink'
        ]}
      >
        {...line.map(({ kind, text }) => (
          <span class={[`settings-reference-${kind}`, KINDS[kind]]}>{text}</span>
        ))}
      </code>
    </div>
  )
}
