import { wcagContrast } from 'culori'
import { expect, it }   from 'vitest'

import { SCHEMES } from '../../../lib/theme/tokens.ts'
import { data }    from '../../common/data/front.ts'

const { date, day, hero, place, strip } = data

it('names the sample day by its weekday, date, month, and year at the place', () => {
  expect([place, date]).toEqual(['Boston', 'Sunday 4 October 2026'])
})

it('sets noon at the minute the sun stands highest', () => {
  expect(day.altitudes[day.noon]).toBe(Math.max(...day.altitudes))
})

it('rises and sets the sun at the crossings of the sunset altitude', () => {
  expect(day.altitudes[day.rise - 1]).toBeLessThan(-5 / 6)
  expect(day.altitudes[day.rise]).toBeGreaterThanOrEqual(-5 / 6 - 0.05)
  expect(day.rise).toBeLessThan(day.noon)
  expect(day.set).toBeGreaterThan(day.noon)
})

it('leaves the cloud factor out wherever no forecast step covers the minute', () => {
  const [from, to] = day.window

  expect([...day.factors.slice(0, from), ...day.factors.slice(to + 1)].filter((factor) => factor !== null))
    .toEqual([])
  expect(day.factors.slice(from, to + 1)).not.toContain(null)
})

it('opens each phase where the one before it ends, from midnight on', () => {
  expect(day.phases[0]!.from).toBe(0)
  expect(day.phases.map(({ name }) => name)).toContain('Daylight')
  expect(day.phases.filter(({ name }, index) => name === day.phases[index - 1]?.name)).toEqual([])
})

it('runs the hero’s light down from noon to the first minute on HomeKit’s floor', () => {
  expect(hero.logs[0]).toBeCloseTo(Math.log10(Math.min(day.clearSkies[day.noon]!, day.range.max)), 3)
  expect(day.readings[day.noon + hero.logs.length - 1]).toBeLessThanOrEqual(day.range.min)
  expect(hero.logs.filter((log, index) => log > (hero.logs[index - 1] ?? log))).toEqual([])
})

it.each(SCHEMES)('inks the letters above the horizon for the most contrast in the %s scheme', (scheme) => {
  const { dark, skies } = hero.schemes[scheme]
  const inks            = ['#f2f1ee', '#1a1a1a']

  expect(skies.filter((sky, step) =>
    wcagContrast(sky, inks[Number(dark[step])]!) < wcagContrast(sky, inks[Number(!dark[step])]!)
  )).toEqual([])
})

it('draws night with light letters and noon with dark ones on the light ground', () => {
  const { dark } = hero.schemes.light

  expect([dark[0], dark.at(-1)]).toEqual([false, true])
})

it.each(SCHEMES)('prefixes every id in the %s scheme’s title with the scheme', (scheme) => {
  const ids = [...hero.schemes[scheme].title.matchAll(/id="([^"]+)"/g)].map(([, id]) => id)

  expect(ids.length).toBeGreaterThan(0)
  expect(ids.filter((id) => !id!.startsWith(`${scheme}-`))).toEqual([])
})

it('shades the strip every ten minutes from midnight to midnight', () => {
  expect([strip.clear.length, strip.forecast.length]).toEqual([145, 145])
})

it('grays the forecast under the clouds and matches the clear sky outside the window', () => {
  expect(strip.forecast[0]).toBe(strip.clear[0])
  expect(strip.forecast.at(-1)).toBe(strip.clear.at(-1))
})

it('keeps every star where the clear sky is dark enough to show it', () => {
  expect(strip.stars.length).toBeGreaterThan(0)
  expect(strip.stars.filter(({ shine }) => shine <= 0.02)).toEqual([])
})

it.each(hero.arcs)('draws arc %# of the sun’s path as dots in its box, the noon sun at the top', (path) => {
  const dots = [...path.matchAll(/M([\d.]+) ([\d.]+)h0/g)].map(([, x, y]) => [Number(x), Number(y)])

  expect(path.replaceAll(/M[\d.]+ [\d.]+h0/g, '')).toBe('')
  expect(Math.min(...dots.map(([, y]) => y!))).toBeLessThan(5)
  expect(dots.filter(([x, y]) => x! < 0 || x! > 900 || y! < 0 || y! > 1000)).toEqual([])
})

it('marks the hour figures a crossing’s chip covers on a narrow strip', () => {
  expect(strip.hours.filter(({ near }) => near).map(({ word }) => word)).toEqual(['03', '09', '15', '21'])
})

it('leaves out each hour figure the sunrise or the sunset chip covers', () => {
  expect(strip.hours.map(({ word }) => word)).toEqual(['00', '03', '09', '12', '15', '21', '24'])
})

it('draws the morning’s clouds across the forecast window alone', () => {
  const [from, to] = day.window

  expect(strip.cloud).toMatch(new RegExp(`^M${from} 60L.*L${to} 60L${to} 60.*L${from} 60Z$`))
})
