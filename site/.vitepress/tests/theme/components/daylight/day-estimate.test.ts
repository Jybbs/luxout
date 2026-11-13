/** @vitest-environment happy-dom */
import { fireEvent, getAllByRole, getByRole } from '@testing-library/dom'
import { expect, vi }                         from 'vitest'
import { nextTick }                           from 'vue'

import { DIAL, DialPlot, type Half } from '../../../../lib/daylight/dial-lens.ts'
import { DURATIONS, PAUSES }         from '../../../../lib/motion/timing.ts'
import { DayEstimate }               from '../../../../theme/components/daylight/day-estimate.tsx'
import { data }                      from '../../../common/data/day-dial.ts'
import { test }                      from '../../../common/mount.ts'

vi.mock('../../../../lib/daylight/day-dial.data.ts', () => import('../../../common/data/day-dial.ts'))

const { opens, stretches } = data
const DAY                  = named('Day')
const DUSK                 = named('Dusk')
const NIGHT                = named('Night')
const ON_DAY               = pointAt(DIAL.rim - 10, Math.PI)
const WINDOW               = named('Window')
const HOVER                = { ...ON_DAY, pointerType: 'mouse' }

async function dwellOver(target: HTMLElement): Promise<void> {
  fireEvent.pointerMove(target, HOVER)
  vi.advanceTimersByTime(PAUSES.dwell)
  await nextTick()
}

function named(stretch: string): number {
  return stretches.findIndex(({ name }) => name === stretch)
}

function overDial(host: HTMLElement): HTMLElement {
  const plot = host.querySelector<HTMLElement>('.day-estimate-plot')!

  vi.spyOn(plot, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: DIAL.width } as DOMRect)

  return plot
}

function pointAt(radius: number, angle: number): { clientX: number, clientY: number } {
  return {
    clientX : DIAL.center.x - radius * Math.sin(angle),
    clientY : DIAL.center.y + radius * Math.cos(angle)
  }
}

async function settle(): Promise<void> {
  vi.advanceTimersByTime(DURATIONS.settle + 32)
  await nextTick()
}

function skyPath(host: HTMLElement, half: Half): string | null {
  return host.querySelector(`[class~='day-estimate-sky'][data-half='${half}']`)!.getAttribute('d')
}

test('opens on the dawn, its bracket lit and its words beside the dial', ({ mount }) => {
  const host  = mount(DayEstimate)
  const shown = host.querySelector('.day-estimate-side .layer.shown')!

  expect(shown.querySelector('.day-estimate-name')!.textContent).toBe(stretches[opens]!.name)
  expect(shown.querySelector('.day-estimate-why')!.textContent).toContain(stretches[opens]!.why)
  expect([...host.querySelectorAll('.day-estimate-layer')].map((layer) => layer.hasAttribute('data-on')))
    .toEqual(stretches.map((_, index) => index === opens))
})

test('names each stretch in a tablist whose selected tab is the one tab stop', ({ mount }) => {
  const tabs = getAllByRole(mount(DayEstimate), 'tab')

  expect(tabs.map(({ textContent }) => textContent)).toEqual(stretches.map(({ name }) => name))
  expect(tabs.map((tab) => tab.tabIndex)).toEqual(stretches.map((_, index) => index === opens ? 0 : -1))
})

test('labels the panel with the selected tab', ({ mount }) => {
  const host = mount(DayEstimate)
  const tab  = getAllByRole(host, 'tab')[opens]!

  expect(getByRole(host, 'tabpanel').getAttribute('aria-labelledby')).toBe(tab.id)
  expect(tab.getAttribute('aria-controls')).toBe(getByRole(host, 'tabpanel').id)
})

test('shows the opened stretch’s figure in the middle of the dial', ({ mount }) => {
  const hub = mount(DayEstimate).querySelector('.day-estimate-hub')!

  expect(hub.querySelector('.layer.shown .day-estimate-figure')!.textContent).toBe(stretches[opens]!.figure)
  expect(hub.classList.contains('peeked')).toBe(false)
})

test('opens the picked stretch on a click, speaks it, and shuts the dawn', async ({ mount }) => {
  const host   = mount(DayEstimate)
  const tabs   = getAllByRole(host, 'tab')
  const opened = skyPath(host, 0)

  fireEvent.click(tabs[DUSK]!)
  await settle()

  const { caption, figure, name } = stretches[DUSK]!

  expect(tabs[DUSK]!.getAttribute('aria-selected')).toBe('true')
  expect(skyPath(host, 0)).not.toBe(opened)

  vi.advanceTimersByTime(PAUSES.speech)
  await nextTick()

  expect(host.querySelector('[aria-live=polite]')!.textContent).toBe(`${name}, ${figure} ${caption}`)
})

test('leaves the clock as it is for a stretch that is no twilight', async ({ mount }) => {
  const host = mount(DayEstimate)

  fireEvent.click(getAllByRole(host, 'tab')[DAY]!)
  await settle()

  const shut = skyPath(host, 1)

  fireEvent.click(getAllByRole(host, 'tab')[NIGHT]!)
  await settle()

  expect(skyPath(host, 1)).toBe(shut)
})

test(
  'moves the focus across the names with the arrow keys and picks the name it lands on',
  async ({ mount }) => {
    const host = mount(DayEstimate)
    const tabs = getAllByRole(host, 'tab')

    tabs[opens]!.focus()
    await nextTick()
    fireEvent.keyDown(tabs[opens]!, { key: 'ArrowRight' })
    await vi.runOnlyPendingTimersAsync()

    expect(document.activeElement).toBe(tabs[opens + 1])
    expect(tabs[opens + 1]!.getAttribute('aria-selected')).toBe('true')
  }
)

test('peeks at the stretch whose name holds the focus, then closes the peek on blur', async ({ mount }) => {
  const host = mount(DayEstimate)
  const tabs = getAllByRole(host, 'tab')
  const hub  = host.querySelector('.day-estimate-hub')!

  tabs[DUSK]!.focus()
  await settle()

  expect(tabs[DUSK]!.classList.contains('peeked')).toBe(true)
  expect(hub.classList.contains('peeked')).toBe(true)
  expect(hub.querySelector('.layer.shown .day-estimate-figure')!.textContent).toBe(stretches[DUSK]!.figure)
  expect(host.querySelectorAll('.day-estimate-layer')[DUSK]!.hasAttribute('data-peek')).toBe(true)

  tabs[DUSK]!.blur()
  await settle()

  expect(tabs[DUSK]!.classList.contains('peeked')).toBe(false)
  expect(hub.classList.contains('peeked')).toBe(false)
})

test('peeks at nothing while the focus rests on the picked name', async ({ mount }) => {
  const host = mount(DayEstimate)
  const tab  = getAllByRole(host, 'tab')[opens]!

  tab.focus()
  await settle()

  expect(tab.classList.contains('peeked')).toBe(false)
  expect(host.querySelector('.day-estimate-hub')!.classList.contains('peeked')).toBe(false)
})

test('eases a peeked twilight a third of the way, and a click opens it to its quarter', async ({ mount }) => {
  const host = mount(DayEstimate)
  const tabs = getAllByRole(host, 'tab')
  const sky  = (open: number) => new DialPlot(data.marks).paths(1, open)[data.marks.washes.length]

  tabs[DUSK]!.focus()
  await nextTick()
  await settle()

  expect(skyPath(host, 1)).toBe(sky(1 / 3))

  fireEvent.click(tabs[DUSK]!)
  await settle()

  expect(skyPath(host, 1)).toBe(sky(1))
})

test('peeks at the stretch under a pointer only after it rests for the dwell pause', async ({ mount }) => {
  const host = mount(DayEstimate)
  const plot = overDial(host)
  const tab  = getAllByRole(host, 'tab')[DAY]!

  fireEvent.pointerMove(plot, HOVER)
  await nextTick()

  expect(tab.classList.contains('peeked')).toBe(false)
  expect(plot.style.cursor).toBe('pointer')

  vi.advanceTimersByTime(PAUSES.dwell)
  await nextTick()

  expect(tab.classList.contains('peeked')).toBe(true)
})

test('starts the dwell again once the pointer drifts past a few pixels', async ({ mount }) => {
  const host = mount(DayEstimate)
  const plot = overDial(host)
  const tab  = getAllByRole(host, 'tab')[DAY]!

  fireEvent.pointerMove(plot, HOVER)
  vi.advanceTimersByTime(PAUSES.dwell - 1)
  fireEvent.pointerMove(plot, { ...HOVER, clientX: ON_DAY.clientX + 8 })
  vi.advanceTimersByTime(1)
  await nextTick()

  expect(tab.classList.contains('peeked')).toBe(false)
})

test('keeps the dwell running while the pointer drifts inside a few pixels', async ({ mount }) => {
  const host = mount(DayEstimate)
  const plot = overDial(host)
  const tab  = getAllByRole(host, 'tab')[DAY]!

  fireEvent.pointerMove(plot, HOVER)
  vi.advanceTimersByTime(PAUSES.dwell - 1)
  fireEvent.pointerMove(plot, { ...HOVER, clientX: ON_DAY.clientX + 2 })
  vi.advanceTimersByTime(1)
  await nextTick()

  expect(tab.classList.contains('peeked')).toBe(true)
})

test.for([
  { name: 'the picked stretch', point: ON_DAY },
  { name: 'the middle of the dial', point: pointAt(0, 0) }
])('clears the pointer cursor over $name', async ({ point }, { mount }) => {
  const host = mount(DayEstimate)
  const plot = overDial(host)

  fireEvent.click(getAllByRole(host, 'tab')[DAY]!)
  await nextTick()
  fireEvent.pointerMove(plot, { ...pointAt(DIAL.rim - 10, 0), pointerType: 'mouse' })

  expect(plot.style.cursor).toBe('pointer')

  fireEvent.pointerMove(plot, { ...point, pointerType: 'mouse' })

  expect(plot.style.cursor).toBe('')
})

test('closes the peek the leave pause after the pointer goes', async ({ mount }) => {
  const host = mount(DayEstimate)
  const plot = overDial(host)
  const tab  = getAllByRole(host, 'tab')[DAY]!

  await dwellOver(plot)
  fireEvent.pointerLeave(plot, { clientX: 0, clientY: 0 })
  vi.advanceTimersByTime(PAUSES.leave)
  await nextTick()

  expect(tab.classList.contains('peeked')).toBe(false)
})

test('keeps a peek open for a pointer returning within the leave pause', async ({ mount }) => {
  const host = mount(DayEstimate)
  const plot = overDial(host)
  const tab  = getAllByRole(host, 'tab')[DAY]!

  await dwellOver(plot)
  fireEvent.pointerLeave(plot, { clientX: 0, clientY: 0 })
  vi.advanceTimersByTime(PAUSES.leave - 1)
  fireEvent.pointerMove(plot, HOVER)
  vi.advanceTimersByTime(PAUSES.leave)
  await nextTick()

  expect(tab.classList.contains('peeked')).toBe(true)
})

test('starts no peek for a touch', async ({ mount }) => {
  const host = mount(DayEstimate)
  const plot = overDial(host)

  fireEvent.pointerMove(plot, { ...ON_DAY, pointerType: 'touch' })
  vi.advanceTimersByTime(PAUSES.dwell)
  await nextTick()

  expect(host.querySelector('.day-estimate-tab.peeked')).toBeNull()
})

test.for([
  { angle: Math.PI, index: DAY, name: 'the day', radius: DIAL.rim - 10 },
  { angle: 0, index: NIGHT, name: 'the night', radius: DIAL.rim - 10 },
  { angle: Math.PI * 0.7, index: WINDOW, name: 'the window on its track', radius: DIAL.rim + 8 }
])('picks $name from a press on its stretch', async ({ angle, index, radius }, { mount }) => {
  const host = mount(DayEstimate)

  fireEvent.pointerDown(overDial(host), pointAt(radius, angle))
  await nextTick()

  expect(getAllByRole(host, 'tab')[index]!.getAttribute('aria-selected')).toBe('true')
})

test.for([
  { name: 'inside the floor ring', radius: DIAL.floor * 0.5 },
  { name: 'past the track', radius: DIAL.rim + 40 }
])('picks nothing for a press $name', async ({ radius }, { mount }) => {
  const host = mount(DayEstimate)

  fireEvent.pointerDown(overDial(host), pointAt(radius, Math.PI))
  await nextTick()

  expect(getAllByRole(host, 'tab')[opens]!.getAttribute('aria-selected')).toBe('true')
})

test('picks nothing for a press on a name, ahead of its click', async ({ mount }) => {
  const host = mount(DayEstimate)
  const tabs = getAllByRole(host, 'tab')

  overDial(host)
  fireEvent.pointerDown(tabs[DUSK]!, ON_DAY)
  await nextTick()

  expect(tabs[opens]!.getAttribute('aria-selected')).toBe('true')
})

test('peeks at the name under a pointer the way it peeks at a stretch', async ({ mount }) => {
  const host = mount(DayEstimate)
  const tab  = getAllByRole(host, 'tab')[DUSK]!

  overDial(host)
  await dwellOver(tab)

  expect(tab.classList.contains('peeked')).toBe(true)
})
