/** @vitest-environment happy-dom */
import { fireEvent, getAllByRole, getByRole } from '@testing-library/dom'
import { expect, vi }                         from 'vitest'
import { nextTick }                           from 'vue'

import { DURATIONS, PAUSES }               from '../../../../lib/motion/timing.ts'
import { ThreeFactors }                    from '../../../../theme/components/daylight/three-factors.tsx'
import { data }                            from '../../../common/data/factor-day.ts'
import { keyOn, pointed, pressable, test } from '../../../common/mount.ts'

vi.mock('../../../../lib/daylight/factor-day.data.ts', () => import('../../../common/data/factor-day.ts'))

const { height, minutes, outside, rest, terms, track } = data
const LAST = minutes.length - 1

function figures(host: HTMLElement): (string | null)[] {
  return [...host.querySelectorAll('.three-factors-big')].map(({ textContent }) => textContent)
}

async function press(host: HTMLElement, key: string): Promise<void> {
  await keyOn(getByRole(host, 'slider'), key)
  vi.advanceTimersByTime(DURATIONS.move + 32)
  await nextTick()
}

function reducedMotion(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    addEventListener    : vi.fn<() => void>(),
    matches             : query.includes('reduce'),
    media               : query,
    removeEventListener : vi.fn<() => void>()
  }))
}

test('opens on the resting minute’s three figures, a tab apiece', ({ mount }) => {
  const host = mount(ThreeFactors)

  expect(getAllByRole(host, 'tab').map((tab) => tab.getAttribute('aria-label')))
    .toEqual(terms.map(({ name }) => name))
  expect(figures(host)).toEqual(terms.map((term) => term.figures[rest]))
})

test('names the resting minute on the slider, with the sum spoken out', ({ mount }) => {
  const slider                  = getByRole(mount(ThreeFactors), 'slider')
  const [clear, share, reading] = terms.map((term) => term.figures[rest])

  expect(slider.getAttribute('aria-valuenow')).toBe(String(rest))
  expect(slider.getAttribute('aria-valuetext'))
    .toBe(`${minutes[rest]}, ${clear} lux times ${share} gives ${reading} lux`)
})

test('opens each term’s plot through its tab', async ({ mount }) => {
  const host = mount(ThreeFactors)
  const tabs = getAllByRole(host, 'tab')

  fireEvent.click(tabs[2]!)
  await nextTick()

  const shown = host.querySelector('.three-factors-slot .layer.shown')!

  expect(shown.querySelector('[role=img]')!.getAttribute('aria-label')).toBe(terms[2].label)
  expect(shown.querySelector('.widget-note')!.textContent).toBe(terms[2].note)
  expect(tabs[2]!.getAttribute('aria-selected')).toBe('true')
})

test('writes every figure and source on a key, with no render', async ({ mount }) => {
  const host = mount(ThreeFactors)

  await press(host, 'Home')

  expect(figures(host)).toEqual(terms.map((term) => term.figures[0]))
  expect([...host.querySelectorAll('.three-factors-source')].map(({ textContent }) => textContent))
    .toEqual(terms.map((term) => term.sources[0]))
  expect(getByRole(host, 'slider').getAttribute('aria-valuenow')).toBe('0')
})

test(
  'moves the sun off the curve below the altitudes drawn, and the thumb along the track',
  async ({ mount }) => {
    const host = mount(ThreeFactors)
    const sun  = host.querySelector<HTMLElement>('.three-factors-sun')!

    await press(host, 'Home')

    expect(sun.style.visibility).toBe('hidden')
    expect(host.querySelector<HTMLElement>('.three-factors-thumb')!.style.left).toBe('0%')

    await press(host, 'End')

    expect(host.querySelector<HTMLElement>('.three-factors-thumb')!.style.left)
      .toBe(`${LAST / minutes.length * 100}%`)
  }
)

test('marks the widget outside the window where no window covers the minute', async ({ mount }) => {
  const host = mount(ThreeFactors)
  const root = host.querySelector('.three-factors')!

  expect(outside[rest]).toBe(false)
  expect(root.hasAttribute('data-outside')).toBe(false)

  await press(host, 'Home')

  expect(root.hasAttribute('data-outside')).toBe(true)
})

test(
  'shows the clear sky’s word under the range where it sits below HomeKit’s floor',
  async ({ mount }) => {
    const host  = mount(ThreeFactors)
    const under = host.querySelector<HTMLElement>('.three-factors-under')!
    const clear = host.querySelector<HTMLElement>('.three-factors-clear')!

    await press(host, 'ArrowRight')

    expect([under.style.visibility, clear.style.visibility]).toEqual(['hidden', 'visible'])

    await press(host, 'Home')

    expect([under.style.visibility, clear.style.visibility]).toEqual(['visible', 'hidden'])
  }
)

test('speaks the minute once a key’s motion settles', async ({ mount }) => {
  const host = mount(ThreeFactors)

  await press(host, 'Home')
  vi.advanceTimersByTime(PAUSES.speech)
  await nextTick()

  expect(host.querySelector('[aria-live=polite]')!.textContent).toContain(minutes[0])
})

test(
  'sets the minute under a pointer from the track’s rectangle, clamped to the day',
  async ({ mount }) => {
    const host   = mount(ThreeFactors)
    const slider = getByRole(host, 'slider')

    pressable(slider, { left: 100, width: 1000 })

    fireEvent.pointerDown(slider.parentElement!, { button: 0, clientX: 600, pointerId: 1 })
    await pointed()
    expect(slider.getAttribute('aria-valuenow')).toBe(String(Math.round(0.5 * LAST)))

    fireEvent.pointerMove(document, { clientX: 5000, pointerId: 1 })
    await pointed()
    expect(slider.getAttribute('aria-valuenow')).toBe(String(LAST))
  }
)

test('plays the morning from its start, then stops at its end', async ({ mount }) => {
  const host   = mount(ThreeFactors)
  const button = getByRole(host, 'button', { name: 'Play the morning' })
  const slider = getByRole(host, 'slider')

  await press(host, 'Home')
  fireEvent.click(button)
  await nextTick()

  expect(button.textContent).toBe('Pause')
  expect(button.getAttribute('aria-pressed')).toBe('true')
  expect(slider.getAttribute('aria-valuenow')).toBe('300')

  vi.advanceTimersByTime(1000)

  expect(Number(slider.getAttribute('aria-valuenow'))).toBeGreaterThan(300)

  vi.advanceTimersByTime(9000)
  await nextTick()

  expect(slider.getAttribute('aria-valuenow')).toBe('810')
  expect(button.textContent).toBe('Play the morning')
})

test('resumes from a minute already inside the morning', async ({ mount }) => {
  const host   = mount(ThreeFactors)
  const button = getByRole(host, 'button', { name: 'Play the morning' })
  const slider = getByRole(host, 'slider')

  fireEvent.click(button)
  await nextTick()
  vi.advanceTimersToNextFrame()

  expect(Number(slider.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(rest)
})

test('speaks the minute the morning pauses on', async ({ mount }) => {
  const host   = mount(ThreeFactors)
  const button = getByRole(host, 'button', { name: 'Play the morning' })

  await press(host, 'Home')
  fireEvent.click(button)
  await nextTick()
  vi.advanceTimersByTime(PAUSES.speech * 2)
  fireEvent.click(button)
  vi.advanceTimersByTime(PAUSES.speech)
  await nextTick()

  const now = Number(getByRole(host, 'slider').getAttribute('aria-valuenow'))

  expect(host.querySelector('[aria-live=polite]')!.textContent).toContain(minutes[now])
})

test('pauses on a second press, and on a key', async ({ mount }) => {
  const host   = mount(ThreeFactors)
  const button = getByRole(host, 'button', { name: 'Play the morning' })

  fireEvent.click(button)
  await nextTick()
  fireEvent.click(button)
  await nextTick()

  expect(button.getAttribute('aria-pressed')).toBe('false')

  fireEvent.click(button)
  await nextTick()
  await press(host, 'Home')

  expect(button.getAttribute('aria-pressed')).toBe('false')
})

test('steps a key from the minute the playing morning shows', async ({ mount }) => {
  const host   = mount(ThreeFactors)
  const button = getByRole(host, 'button', { name: 'Play the morning' })
  const slider = getByRole(host, 'slider')

  await press(host, 'Home')
  fireEvent.click(button)
  await nextTick()
  slider.focus()
  await nextTick()
  vi.advanceTimersByTime(1000)
  await nextTick()

  const now = Number(slider.getAttribute('aria-valuenow'))

  fireEvent.keyDown(slider, { key: 'ArrowRight' })
  vi.advanceTimersByTime(DURATIONS.move + 32)
  await nextTick()

  expect(slider.getAttribute('aria-valuenow')).toBe(String(now + 1))
})

test('writes the minute’s clock and reading on the slider as the morning plays', async ({ mount }) => {
  const host   = mount(ThreeFactors)
  const button = getByRole(host, 'button', { name: 'Play the morning' })
  const slider = getByRole(host, 'slider')

  await press(host, 'Home')
  fireEvent.click(button)
  await nextTick()
  vi.advanceTimersByTime(1000)

  const now = Number(slider.getAttribute('aria-valuenow'))

  expect(slider.getAttribute('aria-valuetext')).toMatch(new RegExp(`^${minutes[now]}, `))
})

test('stops the morning once the viewer’s motion setting turns to reduce', async ({ mount }) => {
  const media = Object.assign(new EventTarget(), { matches: false, media: '' })

  vi.stubGlobal('matchMedia', () => media)

  const button = getByRole(mount(ThreeFactors), 'button', { name: 'Play the morning' })

  fireEvent.click(button)
  await nextTick()

  expect(button.getAttribute('aria-pressed')).toBe('true')

  media.dispatchEvent(Object.assign(new Event('change'), { matches: true }))
  await nextTick()

  expect(button.getAttribute('aria-pressed')).toBe('false')
})

test('disables the play button under reduced motion', ({ mount }) => {
  reducedMotion()

  const button = getByRole<HTMLButtonElement>(mount(ThreeFactors), 'button', { name: 'Play the morning' })

  expect(button.disabled).toBe(true)
})

test('sets each plot to the height its marks are drawn in', ({ mount }) => {
  const plots = mount(ThreeFactors).querySelectorAll<HTMLElement>('.three-factors-plot')

  expect([...plots].map(({ style }) => style.height)).toEqual(terms.map(() => `${height}px`))
})

test('draws the stored window on the track', ({ mount }) => {
  const window = mount(ThreeFactors).querySelector<HTMLElement>('.three-factors-window')!

  expect(window.style.left).toBe(`${track.from}%`)
  expect(window.style.width).toBe(`${track.to - track.from}%`)
})
