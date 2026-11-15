/** @vitest-environment happy-dom */
import { fireEvent, getAllByRole, getByRole } from '@testing-library/dom'
import { expect, vi }                         from 'vitest'
import { nextTick }                           from 'vue'

import { PAUSES }      from '../../../../lib/motion/timing.ts'
import { SourceLamps } from '../../../../theme/components/front/source-lamps.tsx'
import { data }        from '../../../common/data/front.ts'
import { test }        from '../../../common/mount.ts'

vi.mock('../../../../lib/front/front.data.ts', () => import('../../../common/data/front.ts'))

const { sources } = data

function credited(host: HTMLElement): string {
  return host.querySelector('.source-lamps-slot .shown a')!.getAttribute('href')!
}

test('sets the sources out as a radio group in a row, the first chosen', ({ mount }) => {
  const host   = mount(SourceLamps)
  const radios = getAllByRole(host, 'radio')

  expect(getByRole(host, 'radiogroup', { name: 'The sources the reading rests on' })).toBeTruthy()
  expect(radios.map((radio) => radio.getAttribute('aria-labelledby') !== null))
    .toEqual(sources.map(() => true))
  expect(radios.map((radio) => (radio as HTMLInputElement).checked))
    .toEqual(sources.map((_, index) => index === 0))
})

test('credits the chosen source’s link beneath the row', ({ mount }) => {
  expect(credited(mount(SourceLamps))).toBe(sources[0]!.link)
})

test('names each source’s license on its card', ({ mount }) => {
  const cards = mount(SourceLamps).querySelectorAll('.source-lamps-credit span.widget-caps')

  expect([...cards].map(({ textContent }) => textContent)).toEqual(sources.map(({ terms }) => terms))
})

test('chooses the source a mouse rests on through the dwell pause and speaks it', async ({ mount }) => {
  const host  = mount(SourceLamps)
  const lamps = host.querySelectorAll('.source-lamps-lamp')

  fireEvent.pointerEnter(lamps[2]!, { pointerType: 'mouse' })
  vi.advanceTimersByTime(PAUSES.dwell)
  await nextTick()

  expect(credited(host)).toBe(sources[2]!.link)

  vi.advanceTimersByTime(PAUSES.speech)
  expect(host.querySelector('[aria-live]')!.textContent).toBe(`${sources[2]!.says} ${sources[2]!.terms}.`)
})

test('chooses nothing for a touch resting on a lamp', async ({ mount }) => {
  const host = mount(SourceLamps)

  fireEvent.pointerEnter(host.querySelectorAll('.source-lamps-lamp')[3]!, { pointerType: 'touch' })
  vi.advanceTimersByTime(PAUSES.dwell)
  await nextTick()

  expect(credited(host)).toBe(sources[0]!.link)
})
