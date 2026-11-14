/** @vitest-environment happy-dom */
import { fireEvent, getAllByRole, getByRole } from '@testing-library/dom'
import { expect, vi }                         from 'vitest'
import { nextTick }                           from 'vue'

import { SOURCES }     from '../../../../lib/config/sources.ts'
import { PAUSES }      from '../../../../lib/motion/timing.ts'
import { SourceLamps } from '../../../../theme/components/front/source-lamps.tsx'
import { test }        from '../../../common/mount.ts'

function credited(host: HTMLElement): string {
  return host.querySelector('.source-lamps-slot .shown a')!.getAttribute('href')!
}

test('sets the sources out as a radio group in a row, the first chosen', ({ mount }) => {
  const host   = mount(SourceLamps)
  const radios = getAllByRole(host, 'radio')

  expect(getByRole(host, 'radiogroup', { name: 'The sources the reading rests on' })).toBeTruthy()
  expect(radios.map((radio) => radio.getAttribute('aria-labelledby') !== null))
    .toEqual(SOURCES.map(() => true))
  expect(radios.map((radio) => (radio as HTMLInputElement).checked))
    .toEqual(SOURCES.map((_, index) => index === 0))
})

test('credits the chosen source’s link beneath the row', ({ mount }) => {
  expect(credited(mount(SourceLamps))).toBe(SOURCES[0]!.link)
})

test('chooses the source a mouse rests on through the dwell pause and speaks it', async ({ mount }) => {
  const host  = mount(SourceLamps)
  const lamps = host.querySelectorAll('.source-lamps-lamp')

  fireEvent.pointerEnter(lamps[2]!, { pointerType: 'mouse' })
  vi.advanceTimersByTime(PAUSES.dwell)
  await nextTick()

  expect(credited(host)).toBe(SOURCES[2]!.link)

  vi.advanceTimersByTime(PAUSES.speech)
  expect(host.querySelector('[aria-live]')!.textContent).toBe(`${SOURCES[2]!.says} ${SOURCES[2]!.terms}.`)
})

test('chooses nothing for a touch resting on a lamp', async ({ mount }) => {
  const host = mount(SourceLamps)

  fireEvent.pointerEnter(host.querySelectorAll('.source-lamps-lamp')[3]!, { pointerType: 'touch' })
  vi.advanceTimersByTime(PAUSES.dwell)
  await nextTick()

  expect(credited(host)).toBe(SOURCES[0]!.link)
})
