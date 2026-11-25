import { mean }                 from 'd3-array'
import { describe, expect, it } from 'vitest'

import { CLOUD_TUNING }           from '../../../../src/daylight/cloud-factor.ts'
import { STEP_MINUTES }           from '../../../../site/.vitepress/lib/daylight/clock.ts'
import { SampleDay }              from '../../../../site/.vitepress/lib/daylight/sample-day.ts'
import { DarkOut, ForecastSteps } from '../../../../site/.vitepress/lib/readme/lanes.ts'

const day                = SampleDay.record()
const sensor             = new DarkOut(day)
const forecast           = new ForecastSteps(day)
const [dawn, dusk]       = sensor.switches
const [opening, closing] = day.span
const covered            = day.steps.findLastIndex((steps) => steps !== undefined)
const borrowed           = forecast.steps
  .map((step, index) => ({ ...step, time: day.window.times[index]! }))
  .filter(({ borrowed }) => borrowed !== undefined)

describe('the sensor Dark Out', () => {
  it('takes the levels the settings form shows as placeholders', () => {
    expect(sensor.entry).toMatchObject({ name: 'Dark Out', offLux: 662, onLux: 2.99 })
  })

  it('switches off once the dawn passes its off level and on once the dusk falls under its on level', () => {
    expect(sensor.switches).toHaveLength(2)
    expect(sensor.states[dawn! - 1]).toBe(true)
    expect(sensor.states[dawn!]).toBe(false)
    expect(day.readings[dawn!]).toBeGreaterThan(sensor.entry.offLux)
    expect(sensor.states[dusk! - 1]).toBe(false)
    expect(sensor.states[dusk!]).toBe(true)
    expect(day.readings[dusk!]).toBeLessThan(sensor.entry.onLux)
  })

  it.for([
    { count: 0, minute: 0 },
    { count: 0, minute: dawn! - 1 },
    { count: 1, minute: dawn! },
    { count: 1, minute: dusk! - 1 },
    { count: 2, minute: dusk! },
    { count: 2, minute: day.readings.length - 1 }
  ])('counts $count switches through minute $minute', ({ count, minute }) => {
    expect(sensor.countBy(minute)).toBe(count)
  })

  it.for([
    { minute: 0, spans: [[0, 0]] },
    { minute: dawn! - 1, spans: [[0, dawn! - 1]] },
    { minute: dusk! - 1, spans: [[0, dawn!]] },
    { minute: dusk! + 10, spans: [[0, dawn!], [dusk!, dusk! + 10]] }
  ])('cuts each span it is on at minute $minute', ({ minute, spans }) => {
    expect(sensor.spansBy(minute)).toEqual(spans)
  })
})

describe('the forecast’s steps', () => {
  it('hold one step per value of the stored window, each a quarter hour after the last', () => {
    const minutes = forecast.steps.map(({ minute }) => minute)

    expect(forecast.steps).toHaveLength(day.window.times.length)
    expect(minutes[0]).toBe(opening)
    expect(minutes.at(-1)).toBe(closing)
    expect(new Set(minutes.slice(1).map((minute, index) => minute - minutes[index]!))).toEqual(
      new Set([STEP_MINUTES])
    )
  })

  it('scale each bar by the step’s sunlight over the day’s highest', () => {
    const shares = forecast.steps.map(({ share }) => share)

    expect(Math.max(...shares)).toBe(1)
    expect(Math.min(...shares)).toBeGreaterThanOrEqual(0)
  })

  it.for([
    { clock: 'none', minute: 0 },
    { clock: 'none', minute: opening - 1 },
    { clock: '06:15', minute: opening },
    { clock: '10:00', minute: 600 },
    { clock: '10:00', minute: 600 + STEP_MINUTES - 1 },
    { clock: '13:00', minute: covered },
    { clock: 'none', minute: covered + 1 }
  ])('light the step $clock at minute $minute', ({ clock, minute }) => {
    expect(forecast.at(minute)?.clock ?? 'none').toBe(clock)
  })

  it('hold a step with the sun under the floor', () => {
    expect(borrowed.length).toBeGreaterThan(0)
  })

  it.for(borrowed)(
    'give the $clock step, its sun under the floor, the mean factor of the nearest daylight steps',
    ({ factor, time, ...step }) => {
      const nearest = day.cloud.nearest(time)

      expect(step.borrowed).toBe(CLOUD_TUNING.nearest)
      expect(factor).toBeCloseTo(mean(nearest, (each) => each.factor)!)
      expect(day.litAt(time)).toBe(false)
    }
  )

  it('give a step with the sun past the floor its forecast over its clear sky', () => {
    const step = forecast.at(600)!

    expect(step.borrowed).toBeUndefined()
    expect(step.factor).toBeCloseTo(Number.parseFloat(step.forecast) / Number.parseFloat(step.clear), 2)
  })

  it('hold the 11:45 step, its forecast past its clear sky, at a factor of 1', () => {
    const step = forecast.at(705)!

    expect(step).toMatchObject({ clock: '11:45', factor: 1, held: true })
    expect(Number.parseFloat(step.forecast)).toBeGreaterThan(Number.parseFloat(step.clear))
  })

  it('hold no step but the 11:45 one at 1', () => {
    expect(forecast.steps.filter(({ held }) => held).map(({ clock }) => clock)).toEqual(['11:45'])
  })
})
