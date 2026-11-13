/** @vitest-environment happy-dom */
import { fireEvent, getByRole } from '@testing-library/dom'
import { expect, vi }           from 'vitest'
import { nextTick }             from 'vue'

import { DURATIONS, PAUSES }               from '../../../../lib/motion/timing.ts'
import { dropAt }                          from '../../../../theme/components/daylight/bridge-drawing.tsx'
import { TwilightBridge }                  from '../../../../theme/components/daylight/twilight-bridge.tsx'
import { data }                            from '../../../common/data/twilight-bridge.ts'
import { keyOn, pointed, pressable, test } from '../../../common/mount.ts'

vi.mock(
  '../../../../lib/daylight/twilight-bridge.data.ts',
  () => import('../../../common/data/twilight-bridge.ts')
)

const { cut, degrees, figures, height, label, phrases, rest, ticks, width, x, y } = data
const LAST = x.length - 1

/**
 * Finds the stop Page Up or Page Down lands on from `stop`, which the slider
 * machine snaps onto the page's grid.
 */
function paged(stop: number): number {
  return Math.min(LAST, 10 * Math.round(stop / 10))
}

async function press(host: HTMLElement, key: string): Promise<void> {
  await keyOn(sliderOf(host), key)
  settle()
}

function reading(host: HTMLElement): (string | null)[] {
  return ['degree', 'figure', 'phrase'].map((name) =>
    host.querySelector(`.twilight-bridge-${name}`)!.textContent
  )
}

function settle(): void {
  vi.advanceTimersByTime(DURATIONS.move + 32)
}

function sliderOf(host: HTMLElement): HTMLElement {
  return getByRole(host, 'slider', { name: 'The sun’s altitude' })
}

test('names the whole drawing through a group holding the slider', ({ mount }) => {
  const host = mount(TwilightBridge)

  expect(getByRole(host, 'group', { name: label })).toBe(host.querySelector('.twilight-bridge'))
})

test('opens on the resting stop', ({ mount }) => {
  const host   = mount(TwilightBridge)
  const slider = sliderOf(host)

  expect(reading(host)).toEqual([degrees[rest], figures[rest], phrases[0]])
  expect(slider.getAttribute('aria-valuenow')).toBe(String(rest))
  expect(slider.getAttribute('aria-valuemax')).toBe(String(LAST))
  expect(slider.getAttribute('aria-valuetext')).toBe(`${degrees[rest]}, ${figures[rest]}. ${phrases[0]}.`)
})

test('sets the plot to the height its data lays the curve across', ({ mount }) => {
  const plot = mount(TwilightBridge).querySelector<HTMLElement>('.twilight-bridge-plot')!

  expect(plot.style.height).toBe(`${height}px`)
})

test('labels the minor ticks apart, and the span’s longer word apart from its short one', ({ mount }) => {
  const host = mount(TwilightBridge)

  expect([...host.querySelectorAll('span.twilight-bridge-minor')].map(({ textContent }) => textContent))
    .toEqual(ticks.filter(({ minor }) => minor).map(({ word }) => word))
  expect(host.querySelector('.twilight-bridge-caps')!.textContent).toBe('The bridge')
  expect(host.querySelector('.twilight-bridge-the')!.textContent).toBe('The ')
})

test('labels each end of the span beside its node', ({ mount }) => {
  const host = mount(TwilightBridge)

  expect(host.querySelector('.twilight-bridge-low')!.textContent).toBe(data.low.word)
  expect(host.querySelector('.twilight-bridge-high')!.textContent).toBe(data.high.word)
  expect(host.querySelectorAll('.twilight-bridge-node')).toHaveLength(2)
})

test.for([
  { goal: 0, key: 'Home' },
  { goal: LAST, key: 'End' },
  { goal: rest + 1, key: 'ArrowRight' },
  { goal: rest - 1, key: 'ArrowLeft' },
  { goal: paged(rest + 10), key: 'PageUp' },
  { goal: paged(rest - 10), key: 'PageDown' }
])('moves the sun, its line, and the figures on $key', async ({ goal, key }, { mount }) => {
  const host = mount(TwilightBridge)
  const sun  = host.querySelector<HTMLElement>('.twilight-bridge-sun')!

  await press(host, key)

  expect(sun.style.left).toBe(`${x[goal]! / width * 100}%`)
  expect(sun.style.top).toBe(`${y[goal]}px`)
  expect(host.querySelector('.twilight-bridge-drop')!.getAttribute('d')).toBe(dropAt(data, goal))
  expect(reading(host).slice(0, 2)).toEqual([degrees[goal], figures[goal]])
  expect(sliderOf(host).getAttribute('aria-valuenow')).toBe(String(goal))
})

test('writes the phrase of the span, of the cutoff, and of the circular past it', async ({ mount }) => {
  const host = mount(TwilightBridge)

  for (let stop = rest; stop < cut; stop++) await press(host, 'ArrowRight')

  expect(reading(host)).toEqual(['−5/6°', '662 lux', phrases[1]])

  await press(host, 'ArrowRight')

  expect(reading(host)).toEqual(['−0.8°', figures[cut + 1], phrases[2]])

  await press(host, 'Home')

  expect(reading(host)[2]).toBe(phrases[0])
})

test('speaks the stop once the motion settles and the speech pause passes', async ({ mount }) => {
  const host = mount(TwilightBridge)

  await press(host, 'Home')
  vi.advanceTimersByTime(PAUSES.speech)
  await nextTick()

  expect(host.querySelector('[aria-live=polite]')!.textContent)
    .toBe(`${degrees[0]}, ${figures[0]}. ${phrases[0]}.`)
})

test('leaves the sun where it stands when the focus leaves', async ({ mount }) => {
  const host = mount(TwilightBridge)

  await press(host, 'Home')
  sliderOf(host).blur()
  settle()

  expect(reading(host)[0]).toBe(degrees[0])
})

test.for([
  { along: 0, goal: 0, name: 'the left edge' },
  { along: 1, goal: LAST, name: 'the right edge' },
  { along: 1.5, goal: LAST, name: 'past the right edge' },
  { along: 0.5, goal: x.findIndex((place) => place >= width / 2), name: 'the middle' }
])('finds the stop nearest a pointer at $name', async ({ along, goal }, { mount }) => {
  const host   = mount(TwilightBridge)
  const slider = sliderOf(host)

  pressable(slider, { left: 100, width: 300 })
  fireEvent.pointerDown(slider.parentElement!, { button: 0, clientX: 100 + along * 300, pointerId: 1 })
  await pointed()

  expect(slider.getAttribute('aria-valuenow')).toBe(String(goal))
})
