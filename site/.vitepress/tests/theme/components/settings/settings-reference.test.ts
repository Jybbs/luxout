/** @vitest-environment happy-dom */
import { fireEvent, getAllByRole }           from '@testing-library/dom'
import { type Mock, beforeEach, expect, vi } from 'vitest'
import { nextTick }                          from 'vue'

import { SettingsReference } from '../../../../theme/components/settings/settings-reference.tsx'
import { data as rows }      from '../../../common/data/settings.ts'
import { test }              from '../../../common/mount.ts'

vi.mock('../../../../lib/settings/settings.data.ts', () => import('../../../common/data/settings.ts'))

function heads(host: HTMLElement): HTMLElement[] {
  return getAllByRole(host, 'button')
}

/**
 * Lays out every row as the sheet does, with a heading above a 1px border and
 * only the open row's panel showing its body.
 */
function laidOut(heading: number, body: number): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const panel = this.closest('.settings-reference-item.open') ? body : 0
    const parts = [
      ['h3', heading],
      ['.settings-reference-body', body],
      ['.settings-reference-panel', panel],
      ['.settings-reference-item', heading + 1 + panel]
    ] as const

    return { height: parts.find(([selector]) => this.matches(selector))![1] } as DOMRect
  })
}

function observed(): { disconnect: Mock<() => void>, report: (width: number) => void } {
  const disconnect                          = vi.fn<() => void>()
  const callbacks: ResizeObserverCallback[] = []

  vi.stubGlobal('ResizeObserver', class {
    disconnect = disconnect
    observe    = vi.fn<() => void>()

    constructor(callback: ResizeObserverCallback) {
      callbacks.push(callback)
    }
  })

  return {
    disconnect : disconnect,
    report     : (width) => callbacks.at(-1)!(
      [{ contentBoxSize: [{ blockSize: 0, inlineSize: width }] }] as never,
      {} as never
    )
  }
}

function openKey(host: HTMLElement): string | null {
  return host.querySelector('.settings-reference-item.open .settings-reference-key')!.textContent
}

beforeEach(() => {
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } })
})

test('lists one line per key with its title, type, and default', ({ mount }) => {
  const lines = heads(mount(SettingsReference))

  expect(lines.map((line) => line.querySelector('.settings-reference-key')!.textContent))
    .toEqual(rows.map(({ key }) => key))
  expect(lines[0]!.textContent).toContain(rows[0]!.title)
  expect(lines[0]!.textContent).toContain(rows[0]!.type)
  expect(lines[0]!.textContent).toContain(rows[0]!.fallback)
})

test('opens the first row and marks the rest inert', ({ mount }) => {
  const host = mount(SettingsReference)

  expect(openKey(host)).toBe(rows[0]!.key)
  expect(heads(host)[0]!.getAttribute('aria-expanded')).toBe('true')
  expect(heads(host)[0]!.getAttribute('aria-disabled')).toBe('true')
  expect(heads(host)[1]!.getAttribute('aria-expanded')).toBe('false')
  expect(host.querySelectorAll('.settings-reference-panel[inert]')).toHaveLength(rows.length - 1)
})

test('moves the open card to the row a reader chooses', async ({ mount }) => {
  const host = mount(SettingsReference)

  fireEvent.click(heads(host)[2]!)
  await nextTick()

  expect(openKey(host)).toBe(rows[2]!.key)
  expect(host.querySelector('.settings-reference-item.above .settings-reference-key')!.textContent)
    .toBe(rows[1]!.key)
})

test('says on the card what the key does, what happens without it, and its line', ({ mount }) => {
  const card = mount(SettingsReference).querySelector('.settings-reference-item.open [role=region]')!
  const line = card.querySelector('.settings-reference-line')!

  expect(card.textContent).toContain(rows[0]!.does)
  expect(card.textContent).toContain(`Without it, ${rows[0]!.without}.`)
  expect(line.textContent).toBe(rows[0]!.line.map(({ text }) => text).join(''))
  expect([...line.children].map(({ className }) => className))
    .toEqual(rows[0]!.line.map(({ kind }) => `settings-reference-${kind}`))
  expect(card.querySelector('.settings-reference-narrow')!.textContent)
    .toBe(`${rows[0]!.title} · default ${rows[0]!.fallback}`)
})

test('ties each row’s button to its card, and the card back to the button', ({ mount }) => {
  const [head] = heads(mount(SettingsReference))
  const card   = document.getElementById(head!.getAttribute('aria-controls')!)!

  expect(card.getAttribute('aria-labelledby')).toBe(head!.id)
})

test('stops observing the list once unmounted', async ({ mount, unmount }) => {
  const { disconnect } = observed()

  mount(SettingsReference)
  await nextTick()
  disconnect.mockClear()
  unmount()

  expect(disconnect).toHaveBeenCalledOnce()
})

test('labels the needed rows on their cards', ({ mount }) => {
  const host = mount(SettingsReference)

  expect(rows[0]!.needed).toBe(true)
  expect(host.querySelector('.settings-reference-item.open .widget-note')!.textContent).toContain('Needed')
})

test('labels the optional rows on their cards', async ({ mount }) => {
  const host  = mount(SettingsReference)
  const place = rows.findIndex(({ needed }) => !needed)

  fireEvent.click(heads(host)[place]!)
  await nextTick()

  expect(host.querySelector('.settings-reference-item.open .widget-note')!.textContent)
    .toContain('Optional')
})

test.for([
  { expected: 1, from: 0, key: 'ArrowDown' },
  { expected: 0, from: 1, key: 'ArrowUp' }
])('moves the focus to row $expected on $key from row $from', ({ expected, from, key }, { mount }) => {
  const lines = heads(mount(SettingsReference))

  expect(fireEvent.keyDown(lines[from]!, { key })).toBe(false)
  expect(document.activeElement).toBe(lines[expected])
})

test('holds the list at the height of its tallest row, measured again at a new width', async ({ mount }) => {
  const { report } = observed()
  const host       = mount(SettingsReference)
  const list       = host.querySelector<HTMLElement>('.settings-reference-list')!

  laidOut(30, 100)
  await nextTick()
  report(600)
  await nextTick()
  expect(list.style.minHeight).toBe(`${rows.length * 31 + 100}px`)

  laidOut(40, 200)
  report(600)
  await nextTick()
  expect(list.style.minHeight).toBe(`${rows.length * 31 + 100}px`)

  report(500)
  await nextTick()
  expect(list.style.minHeight).toBe(`${rows.length * 41 + 200}px`)
})

test('ignores the fonts loading once unmounted', async ({ mount, unmount }) => {
  const fonts = Promise.withResolvers<void>()

  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: fonts.promise } })

  const list = mount(SettingsReference).querySelector<HTMLElement>('.settings-reference-list')!

  await nextTick()
  unmount()
  fonts.resolve()
  await fonts.promise
  await nextTick()

  expect(list.style.minHeight).toBe('')
})

test('measures the list again at the same width once the fonts load', async ({ mount }) => {
  const fonts      = Promise.withResolvers<void>()
  const { report } = observed()

  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: fonts.promise } })

  const host = mount(SettingsReference)
  const list = host.querySelector<HTMLElement>('.settings-reference-list')!

  laidOut(30, 100)
  await nextTick()
  report(600)
  await nextTick()
  laidOut(40, 200)
  fonts.resolve()
  await fonts.promise
  await nextTick()

  expect(list.style.minHeight).toBe(`${rows.length * 41 + 200}px`)
})
