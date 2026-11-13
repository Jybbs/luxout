/** @vitest-environment happy-dom */
import { fireEvent, getAllByRole } from '@testing-library/dom'
import { expect, vi }              from 'vitest'
import { nextTick }                from 'vue'

import { DURATIONS, PAUSES } from '../../../../lib/motion/timing.ts'
import { RequestClock }      from '../../../../theme/components/privacy/request-clock.ts'
import { data }              from '../../../common/data/privacy.ts'
import { test }              from '../../../common/mount.ts'

vi.mock('../../../../lib/privacy/privacy.data.ts', () => import('../../../common/data/privacy.ts'))

const { clock }               = data
const { radii }               = clock
const { enter, hover, settle } = DURATIONS
const FRAME                   = 16

function core(host: HTMLElement): string[] {
  return [...host.querySelector('.request-clock-core')!.children].map(({ textContent }) => textContent)
}

function face(host: HTMLElement): HTMLElement {
  return host.querySelector<HTMLElement>('.request-clock-face')!
}

async function choose(host: HTMLElement, index: number): Promise<void> {
  fireEvent.click(getAllByRole(host, 'tab')[index]!)
  await nextTick()
}

async function wait(milliseconds: number): Promise<void> {
  vi.advanceTimersByTime(milliseconds)
  await nextTick()
}

test('opens on how often the plugin asks, a tab apiece for each state', ({ mount }) => {
  const host  = mount(RequestClock)
  const often = clock.states[0]!

  expect(getAllByRole(host, 'tab').map((tab) => tab.getAttribute('aria-label')))
    .toEqual(clock.states.map(({ name }) => name))
  expect(core(host)).toEqual([often.big, often.small])
  expect(face(host).dataset.on).toBe(often.key)
  expect(face(host).getAttribute('aria-label')).toBe(clock.label)
})

test('lands what a request carries once the dot has gone out and come back', async ({ mount }) => {
  const host  = mount(RequestClock)
  const sends = clock.states[1]!

  await choose(host, 1)

  expect(face(host).dataset.on).toBe('away')

  await wait(2 * settle + hover - FRAME)

  expect(core(host)).toEqual([clock.states[0]!.big, clock.states[0]!.small])

  await wait(4 * FRAME)

  expect(face(host).dataset.on).toBe(sends.key)
  expect(core(host)).toEqual([sends.big, sends.small])
  expect(host.querySelector('.request-clock-panel .layer.shown')!.textContent).toBe(sends.text)
})

test('lands the failing hour once its dot reaches the rim, with nothing coming back', async ({ mount }) => {
  const host  = mount(RequestClock)
  const fails = clock.states[2]!
  const out   = settle * (radii.rim - radii.core) / (radii.far - radii.core)

  await choose(host, 2)
  await wait(out + 2 * FRAME)

  expect(face(host).dataset.on).toBe(fails.key)
  expect(core(host)).toEqual([fails.big, fails.small])
  expect(host.querySelector('.request-clock-reply')!.getAttribute('opacity')).toBe('0')
})

test('hides the reply on its way back once the failing hour is chosen', async ({ mount }) => {
  const host  = mount(RequestClock)
  const reply = host.querySelector('.request-clock-reply')!

  await choose(host, 1)
  await wait(settle + hover + settle / 2)

  expect(Number(reply.getAttribute('opacity'))).toBeGreaterThan(0)

  await choose(host, 2)
  await wait(2 * FRAME)

  expect(reply.getAttribute('opacity')).toBe('0')
})

test('fades the core back in over the enter duration and then stops its frames', async ({ mount }) => {
  const host  = mount(RequestClock)
  const words = host.querySelector<HTMLElement>('.request-clock-core')!

  await choose(host, 1)
  await wait(2 * settle + hover + enter / 2)

  expect(Number(words.style.opacity)).toBeGreaterThan(0)
  expect(Number(words.style.opacity)).toBeLessThan(1)

  await wait(enter)

  expect(words.style.opacity).toBe('')
  expect(vi.getTimerCount()).toBe(0)
})

test('lands a state at once under reduced motion', async ({ mount }) => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }))

  const host = mount(RequestClock)

  await choose(host, 2)

  expect(face(host).dataset.on).toBe(clock.states[2]!.key)
  expect(vi.getTimerCount()).toBe(1)
})

test('lands a state on the next frame once reduced motion turns on mid-journey', async ({ mount }) => {
  const host  = mount(RequestClock)
  const sends = clock.states[1]!

  await choose(host, 1)
  await wait(settle)

  expect(face(host).dataset.on).toBe('away')

  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }))
  await wait(FRAME)

  expect(face(host).dataset.on).toBe(sends.key)
  expect(core(host)).toEqual([sends.big, sends.small])
})

test('speaks the chosen state once the speech pause has passed', async ({ mount }) => {
  const host = mount(RequestClock)

  await choose(host, 2)
  await wait(PAUSES.speech)

  expect(host.querySelector('[aria-live]')!.textContent).toBe(clock.states[2]!.text)
})

test('sends the request again from its mark on the face', async ({ mount }) => {
  const host = mount(RequestClock)

  fireEvent.click(host.querySelector('.request-clock-send')!)
  await nextTick()

  expect(face(host).dataset.on).toBe('away')

  await wait(2 * settle + hover + 4 * FRAME)

  expect(face(host).dataset.on).toBe(clock.states[0]!.key)
})

test('leaves no frame running once unmounted mid-journey', async ({ mount, unmount }) => {
  const host = mount(RequestClock)

  await choose(host, 1)
  vi.advanceTimersByTime(settle)
  unmount()
  vi.advanceTimersByTime(PAUSES.speech)

  expect(vi.getTimerCount()).toBe(0)
})
