import { expect, it } from 'vitest'

import { CLOUD_TUNING } from '../../../../../src/daylight/cloud-factor.ts'
import { SampleDay }    from '../../../lib/daylight/sample-day.ts'
import { data }         from '../../common/data/cloud-steps.ts'

const { floor, hours, opens, steps, strip } = data
const borrowed                              = steps.filter(({ borrowed }) => borrowed)
const lit                                   = steps.filter(({ borrowed }) => !borrowed)

it('writes one step per value of the stored window', () => {
  expect(steps).toHaveLength(SampleDay.record().window.times.length)
})

it('takes the plugin’s floor', () => {
  expect(floor).toBe(CLOUD_TUNING.floor)
})

it('opens on the 10:00 step', () => {
  expect(steps[opens]!.clock).toBe('10:00')
})

it('writes the division behind a step under the clear sky', () => {
  const step = lit.find(({ sum }) => !sum.includes('held'))!

  expect(step.sum).toMatch(/^[\d.]+ ÷ [\d.]+ = 0\.\d{3}$/)
  expect(step.how).toContain('Open-Meteo’s sunlight at the ground over the Haurwitz clear sky')
})

it('writes the mean behind a step whose sun sits below the floor', () => {
  const step = borrowed[0]!

  expect(step.sum).toMatch(new RegExp(`^\\(.+\\) ÷ ${CLOUD_TUNING.nearest} = [\\d.]+$`))
  expect(step.how).toContain('the mean of the steps at')
  expect(step.lead).toContain(`under ${CLOUD_TUNING.floor}°`)
  expect(step.text).toContain('borrowed')
})

it('holds a step whose forecast runs past a clear sky at 1, and states it', () => {
  const held = steps.find(({ sum }) => sum.endsWith('held at 1'))!

  expect(held.share).toBe('100%')
  expect(held.how).toContain('held at 1')
  expect(held.bars.forecast).toBe(100)
})

it.each(lit)('draws the taller of the two bars of the $clock step across the full lane', ({ bars }) => {
  expect(Math.max(bars.clear, bars.forecast)).toBe(100)
})

it('draws no bars for a step with no sunlight on either side', () => {
  expect(steps[0]!.bars).toEqual({ clear: 0, forecast: 0 })
})

it('places a share of 1 at the top of the strip and a lower share under it', () => {
  const held  = steps.find(({ share }) => share === '100%')!
  const under = lit.find(({ share }) => share !== '100%')!

  expect(held.top).toBe(strip.full)
  expect(under.top).toBeGreaterThan(strip.full)
  expect(under.top).toBeLessThan(strip.axis)
})

it('fits one step’s width across the strip per step', () => {
  expect(strip.pitch * steps.length).toBeCloseTo(strip.width, 8)
  expect(strip.bar).toBeLessThan(strip.pitch)
})

it('places each hour’s word on the center of its step', () => {
  expect(hours.map(({ x }) => x)).toEqual(hours.map(({ word }) =>
    expect.closeTo(strip.pitch * (steps.findIndex(({ clock }) => clock === word) + 0.5), 0)
  ))
})
