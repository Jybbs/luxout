/** @vitest-environment happy-dom */
import { fireEvent, getAllByRole, getByRole } from '@testing-library/dom'
import { expect, vi }                         from 'vitest'
import { h, nextTick }                        from 'vue'
import { renderToString }                     from 'vue/server-renderer'

import { PAUSES }         from '../../../../lib/motion/timing.ts'
import { LocationSearch } from '../../../../theme/components/search/location-search.tsx'
import { data }           from '../../../common/data/search.ts'
import { stubMedia }      from '../../../common/media.ts'
import { test }           from '../../../common/mount.ts'

vi.mock('../../../../lib/search/search.data.ts', () => import('../../../common/data/search.ts'))

const last   = data.stages.length - 1
const stages = data.stages.map(({ name, page }, index) => ({ index, name, page }))

async function advance(milliseconds: number): Promise<void> {
  vi.advanceTimersByTime(milliseconds)
  await nextTick()
}

async function choose(host: HTMLElement, index: number): Promise<void> {
  fireEvent.click(getAllByRole(host, 'tab')[index]!)
  await nextTick()
}

function input(host: HTMLElement): string | null {
  return host.querySelector('.location-search-input')!.textContent
}

function shownStage(host: HTMLElement): number {
  return getAllByRole(host, 'tab').findIndex((tab) => tab.getAttribute('aria-selected') === 'true')
}

test('opens on the last stage with the stored coordinates and the saved block', ({ mount }) => {
  const host   = mount(LocationSearch)
  const stored = host.querySelector('.location-search-stored')!.textContent

  expect(shownStage(host)).toBe(last)
  expect(stored).toContain(data.latitude)
  expect(stored).toContain(data.longitude)
  expect(host.querySelector('.layer.shown .location-search-code')!.textContent).toContain('"platform"')
})

test('hides the replayed page from a screen reader', ({ mount }) => {
  const page = mount(LocationSearch).querySelector('.location-search-page')!

  expect(page.getAttribute('aria-hidden')).toBe('true')
})

test('names the place beneath the coordinates, its first piece in bold', ({ mount }) => {
  const kept   = mount(LocationSearch).querySelector('.location-search-kept')!
  const pieces = [...kept.querySelectorAll('.location-search-whole')].map(({ localName }) => localName)

  expect(kept.textContent).toContain(data.place.join(', '))
  expect(pieces).toEqual(data.place.map((_, index) => index ? 'span' : 'b'))
})

test('credits each source under its license', ({ mount }) => {
  const { geonames, license, under, weather } = data.labels
  const host                                  = mount(LocationSearch)
  const credits                               = host.querySelector('.location-search-credits')!.children

  expect([...credits].map(({ textContent }) => textContent))
    .toEqual([weather, geonames].map((source) => `${source} ${under} ${license}`))
})

test('shows what crosses at the stage a reader chooses', async ({ mount }) => {
  const host = mount(LocationSearch)

  await choose(host, 2)

  expect(shownStage(host)).toBe(2)
  expect(host.querySelector('.layer.shown .location-search-code')!.textContent).toContain('GET /v1/search')
  expect(getByRole(host, 'tabpanel').getAttribute('aria-labelledby')).toBe(getAllByRole(host, 'tab')[2]!.id)
})

test('leaves out the code block on a stage that sends nothing', async ({ mount }) => {
  const host = mount(LocationSearch)

  await choose(host, 0)

  expect(host.querySelector('.layer.shown .location-search-code')).toBeNull()
  expect(input(host)).toBe(data.labels.placeholder)
})

test('speaks the stage once the speech pause has passed', async ({ mount }) => {
  const host = mount(LocationSearch)

  await choose(host, 2)
  await advance(PAUSES.speech)

  const spoken = host.querySelector('[aria-live]')!.textContent

  expect(spoken).toContain(`Stage 3, ${data.stages[2]!.name}`)
})

test('speaks a stage’s words without the backticks around a file name', async ({ mount }) => {
  const host = mount(LocationSearch)

  await choose(host, data.stages.findIndex(({ note }) => note.includes('`')))
  await advance(PAUSES.speech)

  const spoken = host.querySelector('[aria-live]')!.textContent

  expect(spoken).toContain('config.json')
  expect(spoken).not.toContain('`')
})

test('replays each stage in order, typing the query one character at a time', async ({ mount }) => {
  const host = mount(LocationSearch)

  fireEvent.click(host.querySelector('.location-search-play')!)
  await nextTick()
  expect(shownStage(host)).toBe(0)

  await advance(1000)
  expect(shownStage(host)).toBe(1)
  expect(input(host)).toBe(data.query.slice(0, 2))

  await advance(1000)
  expect(input(host)).toBe(data.query)

  await advance(6000)
  expect(shownStage(host)).toBe(last)

  vi.advanceTimersToNextFrame()
  expect(vi.getTimerCount()).toBe(0)
})

test('speaks the first stage as a replay opens, in place of a line still waiting', async ({ mount }) => {
  const host = mount(LocationSearch)

  await choose(host, 2)
  fireEvent.click(host.querySelector('.location-search-play')!)
  await advance(PAUSES.speech)

  expect(host.querySelector('[aria-live]')!.textContent).toContain(`Stage 1, ${data.stages[0]!.name}`)
})

test('stops the replay when a reader chooses a stage', async ({ mount }) => {
  const host = mount(LocationSearch)

  fireEvent.click(host.querySelector('.location-search-play')!)
  await advance(100)
  await choose(host, 3)
  await advance(8000)

  expect(shownStage(host)).toBe(3)
})

test('shows the whole query on a stage a reader chooses in the middle of the typing', async ({ mount }) => {
  const host = mount(LocationSearch)

  fireEvent.click(host.querySelector('.location-search-play')!)
  await advance(1000)
  await choose(host, 3)

  expect(input(host)).toBe(data.query)
})

test('leaves no frame and no timer running once unmounted', ({ mount, unmount }) => {
  const host = mount(LocationSearch)
  const idle = vi.getTimerCount()

  fireEvent.click(host.querySelector('.location-search-play')!)
  expect(vi.getTimerCount()).toBeGreaterThan(idle)

  unmount()
  vi.advanceTimersToNextFrame()

  expect(vi.getTimerCount()).toBe(0)
})

test('turns the replay off under reduced motion', async ({ mount }) => {
  stubMedia(() => true)

  const host = mount(LocationSearch)

  await nextTick()

  expect(host.querySelector<HTMLButtonElement>('.location-search-play')!.disabled).toBe(true)
})

test('turns the replay off while the reader has paused the site’s drawings', async ({ mount }) => {
  localStorage.setItem('luxout-paused', 'true')

  const host = mount(LocationSearch)

  await nextTick()

  expect(host.querySelector<HTMLButtonElement>('.location-search-play')!.disabled).toBe(true)
})

test('pauses the spinner while the site’s drawings are paused', async ({ mount }) => {
  const host = mount(LocationSearch)

  await choose(host, stages.findIndex(({ page }) => page.activity === 'spinning'))

  const spinners = [...host.querySelectorAll('[class~="motion-safe:animate-turn"]')]

  expect(spinners).not.toEqual([])
  expect(spinners.map(({ classList }) => classList.contains('paused:[animation-play-state:paused]')))
    .toEqual(spinners.map(() => true))
})

test('keeps the Play button enabled through the server render under reduced motion', async () => {
  stubMedia(() => true)

  const host = document.createElement('div')

  host.innerHTML = await renderToString(h(LocationSearch))

  expect(host.querySelector<HTMLButtonElement>('.location-search-play')!.disabled).toBe(false)
})

test.for(stages)('draws the $name stage of the page from its fields', async ({ index, page }, { mount }) => {
  const host = mount(LocationSearch)

  await choose(host, index)

  expect({
    activity : host.querySelector<HTMLElement>('.location-search-page')!.dataset.activity,
    caret    : host.querySelector('.location-search-input .location-search-caret') !== null,
    chosen   : host.querySelector('.location-search-match.chosen') !== null,
    figures  : host.querySelector('.location-search-stored .layer.shown .location-search-figure') !== null,
    kept     : host.querySelector('.location-search-kept .layer.shown')!.textContent !== '',
    listed   : host.querySelector('.location-search-list .layer.shown .location-search-match') !== null
  }).toEqual({
    activity : page.activity,
    caret    : page.activity === 'typing',
    chosen   : page.match === 'chosen',
    figures  : page.match === 'chosen',
    kept     : page.match === 'chosen',
    listed   : page.match !== 'none'
  })
})

test('renders a file name in a stage’s words as code', async ({ mount }) => {
  const host = mount(LocationSearch)

  await choose(host, 4)

  expect(host.querySelector('.layer.shown .location-search-sent p code')!.textContent).toBe('config.json')
})
