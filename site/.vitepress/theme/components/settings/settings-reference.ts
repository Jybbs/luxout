import { useElementSize } from '@vueuse/core'
import { max, sum }       from 'd3-array'
import { type VNode, defineComponent, h, onMounted, shallowRef, useId, watch } from 'vue'

import type { SettingRow } from '../../../lib/settings/rows.ts'
import { data as rows }    from '../../../lib/settings/settings.data.ts'
import { FocusRow }        from '../../controls/focus-row.ts'

import './styles/settings-reference.css'

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
    const card  = {
      'aria-labelledby' : id,
      class             : 'settings-reference-panel',
      id                : `${id}-panel`,
      inert             : !open,
      role              : 'region'
    }
    const head = {
      'aria-controls' : `${id}-panel`,
      'aria-disabled' : open || undefined,
      'aria-expanded' : open,
      class           : 'settings-reference-row',
      id              : id,
      onClick         : () => { this.#open.value = index },
      onKeydown       : (event: KeyboardEvent) => this.#focus.move(event, index),
      ref             : (element: unknown) => this.#focus.keep(element, index),
      type            : 'button'
    }

    return h('div', { class: ['settings-reference-item', { above, open }] }, [
      h('h3', [
        h('button', head, [
          h('code', { class: 'settings-reference-key' }, row.key),
          h('span', { class: 'settings-reference-wide' }, row.title),
          h('code', { class: 'settings-reference-type' }, row.type),
          h('code', { class: 'settings-reference-wide settings-reference-default' }, row.fallback),
          h('span', { 'aria-hidden': true, class: 'settings-reference-mark' })
        ])
      ]),
      h('div', card, h('div', { class: 'settings-reference-clip' }, body(row)))
    ])
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

    return () => h('div', { class: 'widget settings-reference' }, [
      h('div', { 'aria-hidden': true, class: 'settings-reference-head widget-caps' }, [
        h('span', 'Key'),
        h('span', { class: 'settings-reference-wide' }, 'Title'),
        h('span', 'Type'),
        h('span', { class: 'settings-reference-wide' }, 'Default'),
        h('span')
      ]),
      h(
        'div',
        {
          class : 'settings-reference-list',
          ref   : accordion.list,
          style : accordion.tallest.value ? { minHeight: `${accordion.tallest.value}px` } : undefined
        },
        rows.map((row, index) => accordion.renderItem(index, row))
      )
    ])
  }
})

function body({ does, fallback, line, needed, title, without }: SettingRow): VNode {
  return h('div', { class: 'settings-reference-body' }, [
    h('span', { class: 'settings-reference-narrow' }, `${title} · default ${fallback}`),
    h('p', { class: 'settings-reference-does' }, does),
    h('p', { class: 'widget-note' }, [
      h('span', { class: 'widget-caps' }, needed ? 'Needed' : 'Optional'),
      ` Without it, ${without}.`
    ]),
    h('code', { class: 'settings-reference-line' }, line.map(({ kind, text }) =>
      h('span', { class: `settings-reference-${kind}` }, text)
    ))
  ])
}
