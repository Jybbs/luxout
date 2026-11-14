/** @vitest-environment happy-dom */
import { getByRole }                         from '@testing-library/dom'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { nextTick }                          from 'vue'

import { useFrontFacts, useFrontMinute } from '../../../../lib/front/minute.ts'
import { DURATIONS }                     from '../../../../lib/motion/timing.ts'
import { DayStrip }                      from '../../../../theme/components/front/day-strip.tsx'
import { data }                          from '../../../common/data/front.ts'
import { stubMedia }                     from '../../../common/media.ts'
import { keyOn, test }                   from '../../../common/mount.ts'

vi.mock('../../../../lib/front/front.data.ts', () => import('../../../common/data/front.ts'))

const { date, day } = data

beforeEach(() => {
  stubMedia(() => false)
})

afterEach(() => {
  useFrontMinute().value = day.noon
})

test('opens on noon, the slider naming the minute’s figures', ({ mount }) => {
  const slider                        = getByRole(mount(DayStrip), 'slider', { name: `Minute of ${date}` })
  const { clear, reading, sun, time } = useFrontFacts()[day.noon]!

  expect(slider.getAttribute('aria-valuenow')).toBe(String(day.noon))
  expect(slider.getAttribute('aria-valuetext'))
    .toBe(`${time}, sun at ${sun}, clear sky ${clear} lux, forecast ${reading} lux`)
})

test('moves the page’s shared minute with the slider, the card reading it', async ({ mount }) => {
  const host = mount(DayStrip)

  await keyOn(getByRole(host, 'slider'), 'ArrowRight')
  vi.advanceTimersByTime(DURATIONS.move + 32)
  await nextTick()

  expect(Math.round(useFrontMinute().value)).toBe(day.noon + 1)
  expect(host.querySelector('.day-strip-card [data-fact="time"]')!.textContent)
    .toBe(useFrontFacts()[day.noon + 1]!.time)
})

test.for([
  ['before sunrise', day.rise - 1, true],
  ['at sunrise', day.rise, false],
  ['after sunset', day.set + 1, true]
] as const)('sets the sun down %s', async ([, minute, down], { mount }) => {
  const host = mount(DayStrip)

  useFrontMinute().value = minute
  await nextTick()

  expect(host.querySelector('.day-strip-sun')!.hasAttribute('data-down')).toBe(down)
})

test('marks the card assumed outside the forecast window', async ({ mount }) => {
  const host = mount(DayStrip)
  const card = host.querySelector('.day-strip-card')!

  useFrontMinute().value = day.window[0] - 1
  await nextTick()
  expect(card.hasAttribute('data-assumed')).toBe(true)

  useFrontMinute().value = day.window[0]
  await nextTick()
  expect(card.hasAttribute('data-assumed')).toBe(false)
})
