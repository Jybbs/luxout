import { useElementSize } from '@vueuse/core'
import { max, sum }       from 'd3-array'
import { type VNode, defineComponent, onMounted, shallowRef, useId, watch } from 'vue'

import type { SettingRow } from '../../../lib/settings/rows.ts'
import { data as rows }    from '../../../lib/settings/settings.data.ts'
import { FocusRow }        from '../../controls/focus-row.ts'

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
 * Holds which row stands open and the list's height with its tallest row open,
 * so opening a shorter row moves nothing beneath the list.
 */
class Accordion {
  readonly list    = shallowRef<HTMLElement>()
  readonly tallest = shallowRef<number>()
  readonly #focus  = new FocusRow('ArrowDown', 'ArrowUp')

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

  readonly #id   = useId()
  readonly #open = shallowRef(0)

  constructor() {
    watch(useElementSize(this.list).width, this.#hold)
    onMounted(() => void document.fonts.ready.then(this.#hold))
  }

  renderItem(index: number, row: SettingRow): VNode {
    const above = this.#open.value === index + 1
    const open  = this.#open.value === index
    const id    = `${this.#id}-${index}`

    return (
      <div
        class={[
          'settings-reference-item border-b border-rule transition-[background-color,box-shadow]',
          'duration-(--timing-fade)',
          { above, 'border-transparent': above || open, open },
          open && [
            'rounded-lg bg-raised',
            'ring ring-rule shadow-[0_10px_24px_-20px_var(--color-shadow)]'
          ]
        ]}
      >
        <h3 class="m-0 border-0 p-0 [font:inherit] tracking-normal">
          <button
            aria-controls={`${id}-panel`}
            aria-disabled={open || undefined}
            aria-expanded={open}
            class={[
              'grid w-full grid-cols-(--columns) items-baseline gap-x-(--gap) rounded-lg px-(--inset) py-2',
              'text-left font-base text-[0.9rem]/[1.4] font-normal text-ink transition-colors',
              'duration-(--timing-hover) *:min-w-0 focus-visible:-outline-offset-2',
              'aria-disabled:cursor-default',
              !open && 'hover:bg-ink/4'
            ]}
            id={id}
            onClick={() => { this.#open.value = index }}
            onKeydown={(event) => this.#focus.move(event, index)}
            ref={(element) => this.#focus.keep(element, index)}
            type="button"
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
                'after:transition-[rotate] after:duration-(--timing-move)',
                open ? 'after:rotate-180' : 'after:rotate-90'
              ]}
            />
          </button>
        </h3>
        <div
          aria-labelledby={id}
          class={[
            'settings-reference-panel grid transition-[grid-template-rows] duration-(--timing-settle)',
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          ]}
          id={`${id}-panel`}
          inert={!open}
          role="region"
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
          'widget [--columns:var(--key)_minmax(0,1fr)_4.75rem_5.5rem_12px] [--gap:14px] [--inset:12px]',
          '[--key:11rem] @max-md:*:[--columns:minmax(0,1fr)_4.75rem_12px] @max-md:*:[--gap:10px]',
          '@max-md:*:[--inset:10px]'
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
