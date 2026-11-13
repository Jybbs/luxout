/** @vitest-environment happy-dom */
import { fireEvent, getAllByRole, getByRole } from '@testing-library/dom'
import { expect, vi }                         from 'vitest'
import { nextTick }                           from 'vue'

import { DebugLine } from '../../../../theme/components/troubleshooting/debug-line.tsx'
import { data }      from '../../../common/data/debug-line.ts'
import { test }      from '../../../common/mount.ts'

vi.mock(
  '../../../../lib/troubleshooting/debug-line.data.ts',
  () => import('../../../common/data/debug-line.ts')
)

const { fields, line } = data
const reading          = fields.findIndex(({ key }) => key === 'reading')

function note(host: HTMLElement): string | null {
  return host.querySelector('.debug-line-notes .layer.shown')!.textContent
}

test('prints the line as the Homebridge log does and reads it out once', ({ mount }) => {
  const host = mount(DebugLine)

  expect(host.querySelector('.debug-line-raw')!.textContent).toBe(line)
  expect(host.querySelector('.debug-line-raw')!.getAttribute('aria-hidden')).toBe('true')
  expect(host.querySelector('.visually-hidden')!.textContent).toBe(`The line reads ${line}`)
})

test('labels a tab per field with its name and its value, in the line’s order', ({ mount }) => {
  expect(getAllByRole(mount(DebugLine), 'tab').map((tab) => tab.getAttribute('aria-label')))
    .toEqual(fields.map(({ name, value }) => `${name}, ${value}`))
})

test('opens on the reading, its note shown and its cell marked on the map', ({ mount }) => {
  const host  = mount(DebugLine)
  const cells = [...host.querySelectorAll('.debug-line-cell')]

  expect(getAllByRole(host, 'tab')[reading]!.getAttribute('aria-selected')).toBe('true')
  expect(note(host)).toBe(fields[reading]!.note)
  expect(cells.findIndex(({ classList }) => classList.contains('on'))).toBe(reading)
})

test('shows the chosen field’s note in its hue', async ({ mount }) => {
  const host  = mount(DebugLine)
  const steps = fields.length - 1
  const tab   = getAllByRole(host, 'tab')[steps]!

  fireEvent.click(tab)
  await nextTick()

  expect(note(host)).toBe(fields[steps]!.note)
  expect(host.querySelector<HTMLElement>('.debug-line-callout')!.dataset.hue).toBe(fields[steps]!.hue)
  expect(getByRole(host, 'tabpanel').getAttribute('aria-labelledby')).toBe(tab.id)
})

test('spans the time across two columns and the forecast steps across the row', ({ mount }) => {
  const cells = [...mount(DebugLine).querySelectorAll<HTMLElement>('.debug-line-cell')]

  expect(cells.map(({ style }) => style.gridColumn))
    .toEqual(fields.map(({ key }) => ({ stamp: 'span 2', steps: '1 / -1' })[key as string] ?? 'auto'))
})
