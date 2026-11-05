/** @vitest-environment happy-dom */
import { fireEvent, getByRole } from '@testing-library/dom'
import { expect, vi }           from 'vitest'
import { nextTick }             from 'vue'

import { formatClock }       from '../../../../lib/daylight/format.ts'
import * as curve            from '../../../../lib/daylight/sun-curve.ts'
import { DURATIONS, PAUSES } from '../../../../lib/motion/timing.ts'
import { SunPath }           from '../../../../theme/components/daylight/sun-path.ts'
import { data }              from '../../../common/data/sun-year.ts'
import { pressable, test }   from '../../../common/mount.ts'

vi.mock('../../../../lib/daylight/sun-year.data.ts', () => import('../../../common/data/sun-year.ts'))

const { days, marks, minutes, rest, sample, year } = data

function clockOf(host: HTMLElement): HTMLElement {
  return getByRole(host, 'slider', { name: 'Time of day', hidden: true })
}

function dayOf(host: HTMLElement): HTMLElement {
  return getByRole(host, 'slider', { name: `Day of ${year}`, hidden: true })
}

async function openYear(host: HTMLElement): Promise<void> {
  fireEvent.click(getByRole(host, 'button', { name: 'The year' }))
  await nextTick()
}

function press(slider: HTMLElement, key: string): void {
  fireEvent.keyDown(slider, { key })
  settle()
}

function settle(): void {
  vi.advanceTimersByTime(DURATIONS.settle + 32)
}

function transforms(host: HTMLElement, selector: string): (string | null)[] {
  return [...host.querySelectorAll(selector)].map((mark) => mark.getAttribute('transform'))
}

test('draws one drawing per layout, each sun at the resting minute', ({ mount }) => {
  expect(transforms(mount(SunPath), '.sun-path-cursor'))
    .toEqual(curve.SUN_LAYOUTS.map((layout) => layout.moveAcross(rest)))
})

test('sets the sentence the page gives it above the drawing', ({ mount }) => {
  const host = mount(SunPath, {}, () => 'The page’s sentence.')

  expect(host.querySelector('.sun-path-lede')!.textContent).toBe('The page’s sentence.')
})

test('opens on the resting minute’s clock and phrase', ({ mount }) => {
  const host = mount(SunPath)

  expect(host.querySelector('.sun-path-clock')!.textContent).toBe(formatClock(rest))
  expect(clockOf(host).getAttribute('aria-valuetext')).toContain(formatClock(rest))
  expect(host.querySelector('.sun-path-phrase')!.textContent)
    .toBe(curve.sunPhrase(days[sample]!, minutes[rest]!, rest))
})

test('moves every sun and its grip on a key, and writes the phrase once it settles', ({ mount }) => {
  const host     = mount(SunPath)
  const midnight = curve.SUN_LAYOUTS.map((layout) => layout.moveAcross(0))

  press(clockOf(host), 'Home')

  expect(transforms(host, '.sun-path-cursor')).toEqual(midnight)
  expect(transforms(host, '.sun-path-grip')).toEqual(midnight)
  expect(clockOf(host).getAttribute('aria-valuenow')).toBe('0')
  expect(host.querySelector('.sun-path-clock')!.textContent).toBe('00:00')
  expect(host.querySelector('.sun-path-phrase')!.textContent).toContain('below the horizon')
})

test('marks the widget while the sun stands under the horizon', ({ mount }) => {
  const host = mount(SunPath)
  const root = host.querySelector('.sun-path')!

  expect(root.hasAttribute('data-down')).toBe(false)

  press(clockOf(host), 'Home')

  expect(root.hasAttribute('data-down')).toBe(true)
})

test('speaks the minute once a key’s motion settles', async ({ mount }) => {
  const host = mount(SunPath)

  press(clockOf(host), 'Home')
  vi.advanceTimersByTime(PAUSES.speech)
  await nextTick()

  expect(host.querySelector('[aria-live=polite]')!.textContent).toMatch(/^00:00, the sun/)
})

test('finds the minute under a pointer from the drawing shown', ({ mount }) => {
  const host    = mount(SunPath)
  const slider  = clockOf(host)
  const [, svg] = host.querySelectorAll('.sun-path-drawing')

  pressable(slider, svg!, { left: 0, width: curve.SUN_LAYOUTS[1].width })

  fireEvent.pointerDown(slider, { button: 0, clientX: curve.SUN_LAYOUTS[1].right, pointerId: 1 })
  settle()

  expect(slider.getAttribute('aria-valuenow')).toBe('1439')
})

test('opens the year on the sample day, with the year’s slider in the note’s place', async ({ mount }) => {
  const host   = mount(SunPath)
  const button = getByRole(host, 'button', { name: 'The year' })

  expect(host.querySelector('.sun-path')!.classList.contains('year')).toBe(false)

  await openYear(host)

  expect(host.querySelector('.sun-path')!.classList.contains('year')).toBe(true)
  expect(button.getAttribute('aria-expanded')).toBe('true')
  expect(dayOf(host).getAttribute('aria-valuenow')).toBe(String(sample))
  expect(dayOf(host).getAttribute('aria-valuetext')).toContain('October 4')
})

test('names the chosen day over the top of its path while the year stands open', async ({ mount }) => {
  const host = mount(SunPath)

  await openYear(host)

  expect(host.querySelector('.sun-path-peak text')!.textContent).toBe(
    `October 4 · ${curve.peakWord(days[sample]!)}`
  )
})

test('moves to another day on a key, redrawing its curve and its marks', async ({ mount }) => {
  const host = mount(SunPath)

  await openYear(host)
  press(dayOf(host), 'Home')

  const january = days[0]!

  expect(dayOf(host).getAttribute('aria-valuenow')).toBe('0')
  expect(host.querySelector('.sun-path-curve')!.getAttribute('d')).toBe(curve.sunCurve(january))
  expect(host.querySelector('.sun-path-wash')!.getAttribute('d')).toBe(curve.sunCurve(january))
  expect(host.querySelector('.sun-path-rise text')!.textContent).toBe(`Sunrise ${formatClock(january.rise)}`)
  expect(host.querySelector('.sun-path-set text')!.textContent).toBe(`Sunset ${formatClock(january.set)}`)
  expect(host.querySelector<HTMLElement>('.sun-path-thumb')!.style.left).toBe('0%')
})

test('steps Page Up and Page Down to the next and the previous curve it keeps', async ({ mount }) => {
  const host   = mount(SunPath)
  const before = marks.findLast(({ day }) => day < sample)!.day
  const after  = marks.find(({ day }) => day > sample)!.day

  await openYear(host)

  press(dayOf(host), 'PageUp')
  expect(dayOf(host).getAttribute('aria-valuenow')).toBe(String(after))

  press(dayOf(host), 'PageDown')
  expect(dayOf(host).getAttribute('aria-valuenow')).toBe(String(sample))

  press(dayOf(host), 'PageDown')
  expect(dayOf(host).getAttribute('aria-valuenow')).toBe(String(before))
})

test('stops Page Up and Page Down at the year’s two ends', async ({ mount }) => {
  const host = mount(SunPath)

  await openYear(host)

  press(dayOf(host), 'End')
  press(dayOf(host), 'PageUp')
  expect(dayOf(host).getAttribute('aria-valuenow')).toBe(String(days.length - 1))

  press(dayOf(host), 'Home')
  press(dayOf(host), 'PageDown')
  expect(dayOf(host).getAttribute('aria-valuenow')).toBe('0')
})

test('holds the day where it stands for a press on the thumb, then drags from there', async ({ mount }) => {
  const host  = mount(SunPath)
  const track = dayOf(host)
  const thumb = host.querySelector<HTMLElement>('.sun-path-thumb')!

  await openYear(host)
  pressable(track, track, { left: 0, width: days.length - 1 })
  vi.spyOn(thumb, 'getBoundingClientRect').mockReturnValue({ left: sample - 8, width: 16 } as DOMRect)

  fireEvent.pointerDown(thumb, { button: 0, clientX: sample + 3, pointerId: 1 })
  expect(track.getAttribute('aria-valuenow')).toBe(String(sample))

  fireEvent.pointerMove(track, { clientX: sample + 13, pointerId: 1 })
  expect(track.getAttribute('aria-valuenow')).toBe(String(sample + 10))
})

test('speaks the minute and the sun’s height on the time slider once a motion ends', ({ mount }) => {
  const slider = clockOf(mount(SunPath))

  press(slider, 'Home')

  expect(slider.getAttribute('aria-valuetext'))
    .toBe(`00:00, ${curve.sunPhrase(days[sample]!, minutes[0]!, 0)}`)
})

test('moves the day to a press on the track', async ({ mount }) => {
  const host  = mount(SunPath)
  const track = dayOf(host)

  await openYear(host)
  pressable(track, track, { left: 0, width: days.length - 1 })

  fireEvent.pointerDown(track, { button: 0, clientX: 40, pointerId: 1 })

  expect(track.getAttribute('aria-valuenow')).toBe('40')
})

test('speaks the day beside the minute while the year stands open', async ({ mount }) => {
  const host = mount(SunPath)

  await openYear(host)
  press(dayOf(host), 'Home')
  vi.advanceTimersByTime(PAUSES.speech)
  await nextTick()

  expect(host.querySelector('[aria-live=polite]')!.textContent).toContain(' on January 1,')
})

test('returns the drawing to the sample day once the year closes', async ({ mount }) => {
  const host = mount(SunPath)

  await openYear(host)
  press(dayOf(host), 'Home')

  fireEvent.click(getByRole(host, 'button', { name: 'The year' }))
  await nextTick()
  settle()

  expect(host.querySelector('.sun-path')!.classList.contains('year')).toBe(false)
  expect(host.querySelector('.sun-path-curve')!.getAttribute('d')).toBe(curve.sunCurve(days[sample]!))
  expect(host.querySelector('.sun-path-peak text')!.textContent).toBe(curve.peakWord(days[sample]!))
})

test('keeps the sample day’s drawing across a second opening of the year', async ({ mount }) => {
  const host = mount(SunPath)

  await openYear(host)
  fireEvent.click(getByRole(host, 'button', { name: 'The year' }))
  await nextTick()
  await openYear(host)

  expect(host.querySelector('.sun-path')!.classList.contains('year')).toBe(true)
  expect(host.querySelector('.sun-path-curve')!.getAttribute('d')).toBe(curve.sunCurve(days[sample]!))
})

test('places the sun once for a one-minute step across a motion’s frames', ({ mount }) => {
  const host  = mount(SunPath)
  const place = vi.spyOn(host.querySelector('.sun-path')!, 'toggleAttribute')

  press(clockOf(host), 'ArrowRight')

  expect(place).toHaveBeenCalledOnce()
})

test('reads a day’s altitude off its samples and the sample day’s off its minutes', async ({ mount }) => {
  const host                   = mount(SunPath)
  const slider                 = clockOf(host)
  const phrase                 = host.querySelector('.sun-path-phrase')!
  const today                  = days[sample]!
  const [, svg]                = host.querySelectorAll('.sun-path-drawing')
  const { left, right, width } = curve.SUN_LAYOUTS[1]
  const said                   = (at: number, altitude: number) => curve.sunPhrase(today, altitude, at)
  const apart                  = minutes.findIndex((altitude, minute) =>
    said(minute, altitude) !== said(minute, curve.altitudeOn(today, minute))
  )

  pressable(slider, svg!, { left: 0, width })
  fireEvent.pointerDown(slider, {
    button    : 0,
    clientX   : left + (right - left) * apart / (minutes.length - 1),
    pointerId : 1
  })
  settle()

  expect(phrase.textContent).toBe(said(apart, minutes[apart]!))

  await openYear(host)
  press(dayOf(host), 'Home')

  expect(phrase.textContent).toBe(curve.sunPhrase(days[0]!, curve.altitudeOn(days[0]!, apart), apart))
})
