/** @vitest-environment happy-dom */
import { fireEvent, getByRole } from '@testing-library/dom'
import { expect, vi }           from 'vitest'
import { nextTick }             from 'vue'

import { PAUSES }          from '../../../../lib/motion/timing.ts'
import { TheCloudFactor }  from '../../../../theme/components/daylight/the-cloud-factor.tsx'
import { data }            from '../../../common/data/cloud-steps.ts'
import { pressable, test } from '../../../common/mount.ts'

vi.mock('../../../../lib/daylight/cloud-steps.data.ts', () => import('../../../common/data/cloud-steps.ts'))

const { floor, opens, steps, strip } = data

test('opens on the 10:00 step, its bars and its share', ({ mount }) => {
  const host = mount(TheCloudFactor)
  const step = steps[opens]!

  expect(host.querySelector('.the-cloud-factor-bars')!.getAttribute('aria-label')).toBe(step.drawn)
  expect(host.querySelector('.layer.shown .the-cloud-factor-share')!.textContent).toBe(step.share)
  expect([...host.querySelectorAll('.the-cloud-factor-value')].map(({ textContent }) => textContent))
    .toEqual([step.clear, step.forecast])
})

test('draws one mark per step in the strip, the picked step lit', ({ mount }) => {
  const host = mount(TheCloudFactor)
  const bars = host.querySelectorAll('.the-cloud-factor-marks rect:not(.the-cloud-factor-picked)')
  const lit  = host.querySelectorAll('.the-cloud-factor-marks rect.on')

  expect(bars).toHaveLength(steps.length)
  expect(lit).toHaveLength(1)
  expect(bars[opens]).toBe(lit[0])
})

test('sets the strip to the height its marks are drawn in', ({ mount }) => {
  const plot = mount(TheCloudFactor).querySelector<HTMLElement>('.the-cloud-factor-strip')!

  expect(plot.style.height).toBe(`${strip.height}px`)
})

test('marks a borrowed step apart from a lit one, in the strip and in the bars', async ({ mount }) => {
  const host   = mount(TheCloudFactor)
  const slider = getByRole(host, 'slider')

  expect(host.querySelectorAll('.the-cloud-factor-marks rect.the-cloud-factor-borrowed'))
    .toHaveLength(steps.filter(({ borrowed }) => borrowed).length)

  fireEvent.keyDown(slider, { key: 'Home' })
  await nextTick()

  expect(host.querySelector('.the-cloud-factor-bars')!.classList.contains('borrowed')).toBe(true)
})

test('moves the picked step on a key and speaks its share', async ({ mount }) => {
  const host   = mount(TheCloudFactor)
  const slider = getByRole(host, 'slider')

  fireEvent.keyDown(slider, { key: 'ArrowRight' })
  await nextTick()

  const step = steps[opens + 1]!

  expect(slider.getAttribute('aria-valuenow')).toBe(String(opens + 1))
  expect(slider.getAttribute('aria-valuetext')).toBe(step.text)

  vi.advanceTimersByTime(PAUSES.speech)
  await nextTick()

  expect(host.querySelector('[aria-live=polite]')!.textContent).toBe(`${step.share}${step.lead}`)
})

test('moves the picked step an hour on Page Up', async ({ mount }) => {
  const slider = getByRole(mount(TheCloudFactor), 'slider')

  fireEvent.keyDown(slider, { key: 'PageUp' })
  await nextTick()

  expect(slider.getAttribute('aria-valuenow')).toBe(String(opens + 4))
})

test('picks the step under a pointer, clamped to the strip', async ({ mount }) => {
  const slider = getByRole(mount(TheCloudFactor), 'slider')

  pressable(slider, slider, { left: 0, width: steps.length })

  fireEvent.pointerDown(slider, { button: 0, clientX: 3.5, pointerId: 1 })
  await nextTick()
  expect(slider.getAttribute('aria-valuenow')).toBe('3')

  fireEvent.pointerMove(slider, { clientX: 1000, pointerId: 1 })
  await nextTick()
  expect(slider.getAttribute('aria-valuenow')).toBe(String(steps.length - 1))
})

test('opens the sum behind the picked step in the key’s place, then closes it', async ({ mount }) => {
  const host   = mount(TheCloudFactor)
  const button = getByRole(host, 'button', { name: 'How' })
  const foot   = host.querySelector('.the-cloud-factor-foot .layers')!

  expect(foot.querySelector(':scope > .layer.shown .the-cloud-factor-keys')).not.toBeNull()

  fireEvent.click(button)
  await nextTick()

  expect(button.getAttribute('aria-expanded')).toBe('true')
  expect(foot.querySelector('.layer.shown .layer.shown .the-cloud-factor-sum')!.textContent)
    .toBe(steps[opens]!.sum)

  fireEvent.click(button)
  await nextTick()

  expect(button.getAttribute('aria-expanded')).toBe('false')
})

test('points the button at the region it opens', ({ mount }) => {
  const host   = mount(TheCloudFactor)
  const button = getByRole(host, 'button', { name: 'How' })

  expect(host.querySelector(`#${CSS.escape(button.getAttribute('aria-controls')!)}`)).not.toBeNull()
})

test('names the plugin’s floor in the key', ({ mount }) => {
  expect(mount(TheCloudFactor).querySelector('.the-cloud-factor-keys')!.textContent)
    .toContain(`Sun under ${floor}°`)
})
