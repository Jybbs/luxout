import { mkdir, readdir } from 'node:fs/promises'
import { join }           from 'node:path'

import { fc }                    from '@fast-check/vitest'
import type { Logging }          from 'homebridge'
import { type Mock, expect, vi } from 'vitest'

import type { Reading }                from '../../src/sensor/reading.js'
import { ForecastClient }              from '../../src/weather/client.js'
import { FetchSchedule }               from '../../src/weather/schedule.js'
import { WindowStore }                 from '../../src/weather/store.js'
import { logging, test as homebridge } from '../common/homebridge.js'
import { delhi }                       from '../common/places.js'
import { spaced }                      from '../common/window.js'

/**
 * Stands in for the `fetch` a schedule requests through, beside the instant
 * each request was sent, in ISO 8601.
 */
interface Served {
  fetch : Mock<typeof fetch>
  sent  : string[]
}

const HOUR   = 3_600_000
const MINUTE = 60_000
const fresh  = spaced(Array(28).fill(300), delhi, '2026-10-11T02:00:00Z')
const held   = spaced(Array(28).fill(400), delhi, '2026-10-11T01:00:00Z')
const test   = homebridge.extend('reading', () => ({ use: vi.fn<Reading['use']>() }))
  .extend('shutdown', () => new AbortController())
  .extend('store', ({ scratch }) => new WindowStore(scratch))

test(
  'draws the second and then the minute of the hourly fetch from 60 values each',
  ({ log, reading, store }) => {
    const random = vi.fn<(max: number) => number>().mockReturnValue(0)

    new FetchSchedule(new ForecastClient(served(answer).fetch), log, delhi, reading, store, random)

    expect(random.mock.calls).toEqual([[60], [60]])
  }
)

test(
  'sends no request at launch where the stored window ends as the first hourly fetch falls',
  async ({ log, reading, shutdown, store }) => {
    const { fetch } = served(answer)

    await store.write(spaced(Array(7).fill(400), delhi, '2026-10-11T01:15:00Z'))
    await scheduled(fetch, log, reading, store, [0, 45]).start(shutdown.signal)

    expect(fetch).not.toHaveBeenCalled()
  }
)

test.for([
  { draw: [1, 45], name: 'ends just before the first hourly fetch', start: '01:15', steps: 7 },
  { draw: [20, 37], name: 'starts after the present', start: '02:15', steps: 28 }
])(
  'fetches at launch where the stored window $name',
  async ({ draw, start, steps }, { log, reading, shutdown, store }) => {
    const { fetch } = served(answer)

    await store.write(spaced(Array(steps).fill(400), delhi, `2026-10-11T${start}:00Z`))
    await scheduled(fetch, log, reading, store, draw).start(shutdown.signal)

    expect(fetch).toHaveBeenCalledOnce()
  }
)

test(
  'hands the reading the stored window and then the one fetched at launch, before starting settles',
  async ({ log, reading, shutdown, store }) => {
    const stored = spaced(Array(6).fill(400), delhi, '2026-10-11T01:15:00Z')

    await store.write(stored)
    await scheduled(served(answer).fetch, log, reading, store).start(shutdown.signal)

    expect(reading.use.mock.calls).toEqual([[stored], [fresh]])
  }
)

test.for([
  {
    now  : '2026-10-11T02:07:30Z',
    sent : ['2026-10-11T02:07:30.000Z', '2026-10-11T02:37:20.000Z', '2026-10-11T03:37:20.000Z'],
    zone : 'UTC'
  },
  {
    now  : '2026-10-11T02:07:30Z',
    sent : ['2026-10-11T02:07:30.000Z', '2026-10-11T02:37:20.000Z', '2026-10-11T03:37:20.000Z'],
    zone : 'Asia/Kolkata'
  },
  {
    now  : '2026-11-01T05:07:30Z',
    sent : ['2026-11-01T05:07:30.000Z', '2026-11-01T05:37:20.000Z', '2026-11-01T06:37:20.000Z'],
    zone : 'America/New_York'
  }
])(
  'fetches each hour at the drawn second and minute of the UTC hour on a host in $zone',
  async ({ now, sent: expected, zone }, { log, reading, shutdown, store }) => {
    const { fetch, sent } = served(answer)

    vi.stubEnv('TZ', zone)
    vi.setSystemTime(new Date(now))
    vi.spyOn(store, 'write').mockResolvedValue()
    await scheduled(fetch, log, reading, store).start(shutdown.signal)
    await vi.advanceTimersByTimeAsync(HOUR + 29 * MINUTE + 50_000)

    expect(sent).toEqual(expected)
  }
)

test(
  'replaces the window in memory and on disk with each one a fetch returns',
  async ({ log, reading, shutdown, store }) => {
    await store.write(held)
    await scheduled(served(answer).fetch, log, reading, store).start(shutdown.signal)
    await vi.advanceTimersByTimeAsync(30 * MINUTE)

    expect(reading.use.mock.calls).toEqual([[held], [fresh]])
    await vi.waitFor(() => expect(store.read(delhi)).resolves.toEqual(fresh))
  }
)

test(
  'logs the one line a failure renders at warn level and keeps serving the window it holds',
  async ({ log, reading, shutdown, store }) => {
    await store.write(held)
    await scheduled(served(refusal).fetch, log, reading, store).start(shutdown.signal)
    await vi.advanceTimersByTimeAsync(30 * MINUTE)

    expect(log.warn).toHaveBeenCalledExactlyOnceWith('Open-Meteo answered with an error (status 503)')
    expect(reading.use.mock.calls).toEqual([[held]])
    await expect(store.read(delhi)).resolves.toEqual(held)
  }
)

test(
  'retries a failing hour at waits doubling from a minute, sending six requests before the next one',
  async ({ log, reading, shutdown, store }) => {
    const { fetch, sent } = served(refusal)

    await store.write(held)
    await scheduled(fetch, log, reading, store).start(shutdown.signal)
    await vi.advanceTimersByTimeAsync(HOUR + 29 * MINUTE + 50_000)

    expect(sent).toEqual([
      '2026-10-11T02:37:20.000Z', '2026-10-11T02:38:20.000Z', '2026-10-11T02:40:20.000Z',
      '2026-10-11T02:44:20.000Z', '2026-10-11T02:52:20.000Z', '2026-10-11T03:08:20.000Z',
      '2026-10-11T03:37:20.000Z'
    ])
  }
)

test.for([
  {
    draw  : [30, 8],
    retry : 'skips the retry that would fall at',
    sent  : ['2026-10-11T02:07:30.000Z', '2026-10-11T02:08:30.000Z']
  },
  {
    draw  : [31, 8],
    retry : 'sends the retry that falls a second before',
    sent  : ['2026-10-11T02:07:30.000Z', '2026-10-11T02:08:30.000Z', '2026-10-11T02:08:31.000Z']
  }
])(
  '$retry the first hourly fetch once the launch fetch fails',
  async ({ draw, sent: expected }, { log, reading, shutdown, store }) => {
    const { fetch, sent } = served(refusal)

    await scheduled(fetch, log, reading, store, draw).start(shutdown.signal)
    await vi.advanceTimersByTimeAsync(MINUTE + 5000)

    expect(sent).toEqual(expected)
  }
)

test(
  'retries through the hour a fall-back repeats on a host in America/New_York',
  async ({ log, reading, shutdown, store }) => {
    const { fetch, sent } = served(refusal)

    vi.stubEnv('TZ', 'America/New_York')
    vi.setSystemTime(new Date('2026-11-01T06:30:00Z'))
    await scheduled(fetch, log, reading, store).start(shutdown.signal)
    await vi.advanceTimersByTimeAsync(5 * MINUTE)

    expect(sent).toEqual(['2026-11-01T06:30:00.000Z', '2026-11-01T06:31:00.000Z', '2026-11-01T06:33:00.000Z'])
  }
)

test(
  'skips an hourly fetch that falls while a retry still waits on its answer',
  async ({ log, reading, shutdown, store }) => {
    const { fetch, sent } = served(refusal, 10_000)

    vi.spyOn(store, 'read').mockResolvedValue(undefined)
    void scheduled(fetch, log, reading, store, [15, 23]).start(shutdown.signal)
    await vi.advanceTimersByTimeAsync(22 * MINUTE)

    expect(sent).toEqual([
      '2026-10-11T02:07:30.000Z', '2026-10-11T02:08:40.000Z', '2026-10-11T02:10:50.000Z',
      '2026-10-11T02:15:00.000Z', '2026-10-11T02:23:10.000Z'
    ])
  }
)

test(
  'defers an hourly fetch that falls while the one before it still runs until that one settles',
  async ({ log, reading, shutdown, store }) => {
    const { fetch, sent } = served(refusal, HOUR + MINUTE)

    await store.write(held)
    await scheduled(fetch, log, reading, store).start(shutdown.signal)
    await vi.advanceTimersByTimeAsync(HOUR + 31 * MINUTE)

    expect(sent).toEqual(['2026-10-11T02:37:20.000Z', '2026-10-11T03:38:20.000Z'])
  }
)

test(
  'keeps fetching each hour after the held window runs out, until a fetch succeeds',
  async ({ log, reading, shutdown, store }) => {
    const later           = spaced(Array(28).fill(300), delhi, '2026-10-11T09:00:00Z')
    const success         = new Date('2026-10-11T09:37:20Z').getTime()
    const { fetch, sent } = served(() => Date.now() < success ? refusal() : Response.json(later))

    await store.write(held)
    await scheduled(fetch, log, reading, store).start(shutdown.signal)
    await vi.advanceTimersByTimeAsync(7 * HOUR + 30 * MINUTE)

    expect(sent).toHaveLength(7 * 6 + 1)
    await vi.waitFor(() => expect(reading.use).toHaveBeenLastCalledWith(later))
  }
)

test(
  'cancels a retry still waiting once a fetch succeeds, as after a host sleeps past the next hourly fetch',
  async ({ log, reading, shutdown, store }) => {
    const { fetch, sent } = served((index) => index === 0 ? refusal() : answer())

    await store.write(held)
    await scheduled(fetch, log, reading, store).start(shutdown.signal)
    await vi.advanceTimersByTimeAsync(30 * MINUTE)
    vi.setSystemTime(new Date('2026-10-11T03:40:00Z'))
    await vi.advanceTimersByTimeAsync(5 * MINUTE)

    expect(sent).toEqual(['2026-10-11T02:37:20.000Z', '2026-10-11T03:40:20.000Z'])
  }
)

test(
  'stops the hourly job and a waiting retry at shutdown, leaving no timer',
  async ({ log, reading, shutdown, store }) => {
    const { fetch, sent } = served(refusal)

    await scheduled(fetch, log, reading, store).start(shutdown.signal)
    shutdown.abort()
    await vi.advanceTimersByTimeAsync(2 * HOUR)

    expect(sent).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  }
)

test(
  'schedules no retry for a failure logged as shutdown comes, leaving no timer',
  async ({ log, reading, shutdown, store }) => {
    const { fetch, sent } = served(refusal)

    vi.mocked(log.warn).mockImplementation(() => shutdown.abort())
    await scheduled(fetch, log, reading, store).start(shutdown.signal)
    await vi.advanceTimersByTimeAsync(HOUR)

    expect(sent).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  }
)

test(
  'aborts the request in flight at shutdown, writing nothing its late answer carries',
  async ({ log, reading, scratch, shutdown, store }) => {
    const { fetch } = served(answer, 5000)

    vi.spyOn(store, 'read').mockResolvedValue(undefined)

    const started = scheduled(fetch, log, reading, store).start(shutdown.signal)

    await vi.advanceTimersByTimeAsync(1000)
    shutdown.abort()
    await vi.advanceTimersByTimeAsync(10_000)
    await started

    expect(fetch.mock.calls.map(([, init]) => init?.signal?.aborted)).toEqual([true])
    expect(reading.use).not.toHaveBeenCalled()
    expect(log.warn).not.toHaveBeenCalled()
    await expect(readdir(scratch)).resolves.toEqual([])
  }
)

test(
  'starts no job where shutdown comes before the stored window is read',
  async ({ log, reading, shutdown, store }) => {
    const { fetch } = served(answer)
    const started   = scheduled(fetch, log, reading, store).start(shutdown.signal)

    shutdown.abort()
    await started
    await vi.advanceTimersByTimeAsync(HOUR)

    expect(fetch).not.toHaveBeenCalled()
    expect(reading.use).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  }
)

test(
  'warns of a stored window it cannot read and fetches at launch',
  async ({ log, reading, scratch, shutdown, store }) => {
    const { fetch } = served(answer)

    await mkdir(join(scratch, 'luxout-forecast.json'))
    await scheduled(fetch, log, reading, store).start(shutdown.signal)

    expect(log.warn).toHaveBeenCalledWith(
      'Outside reads no stored forecast, since reading it failed: %s',
      expect.objectContaining({ code: 'EISDIR' })
    )
    expect(fetch).toHaveBeenCalledOnce()
  }
)

test(
  'warns of a window it cannot store, keeping it in memory and sending no retry',
  async ({ log, reading, scratch, shutdown }) => {
    const { fetch } = served(answer)
    const store     = new WindowStore(join(scratch, 'missing'))

    await scheduled(fetch, log, reading, store).start(shutdown.signal)
    await vi.advanceTimersByTimeAsync(5 * MINUTE)

    expect(log.warn).toHaveBeenCalledExactlyOnceWith(
      'Outside keeps the forecast it fetched in memory alone, since storing it failed: %s',
      expect.objectContaining({ code: 'ENOENT' })
    )
    expect(reading.use).toHaveBeenCalledExactlyOnceWith(fresh)
    expect(fetch).toHaveBeenCalledOnce()
  }
)

test(
  'logs an error the reading raises on a fetched window and keeps fetching each hour',
  async ({ log, reading, shutdown, store }) => {
    const error           = new Error('The window holds no daylight')
    const { fetch, sent } = served(answer)

    reading.use.mockImplementation(() => {
      throw error
    })
    await scheduled(fetch, log, reading, store).start(shutdown.signal)
    await vi.advanceTimersByTimeAsync(30 * MINUTE)

    expect(sent).toEqual(['2026-10-11T02:07:30.000Z', '2026-10-11T02:37:20.000Z'])
    expect(vi.mocked(log.error).mock.calls).toEqual([
      ['Outside could not refresh the forecast: %s', error],
      ['Outside could not refresh the forecast: %s', error]
    ])
  }
)

test(
  'logs an error the reading raises on a window a retry fetched',
  async ({ log, reading, shutdown, store }) => {
    const error     = new Error('The window holds no daylight')
    const { fetch } = served((index) => index === 0 ? refusal() : answer())

    reading.use.mockImplementation(() => {
      throw error
    })
    await scheduled(fetch, log, reading, store).start(shutdown.signal)
    await vi.advanceTimersByTimeAsync(2 * MINUTE)

    expect(vi.mocked(log.error).mock.calls).toEqual([['Outside could not refresh the forecast: %s', error]])
  }
)

test('hands an answer to the reading and the store only where it arrives before shutdown', async () => {
  await fc.assert(fc.asyncProperty(fc.scheduler(), async (scheduler) => {
    const log      = logging()
    const reading  = { use: vi.fn<Reading['use']>() }
    const shutdown = new AbortController()
    const store    = new WindowStore('')
    const write    = vi.spyOn(store, 'write').mockResolvedValue()
    const fetch    = vi.fn<typeof globalThis.fetch>(
      scheduler.scheduleFunction(async () => Response.json(fresh))
    )

    vi.spyOn(store, 'read').mockResolvedValue(undefined)
    void scheduler.schedule(Promise.resolve(), 'shutdown').then(() => shutdown.abort())
    await scheduler.waitFor(scheduled(fetch, log, reading, store).start(shutdown.signal))
    await scheduler.waitIdle()
    shutdown.abort()

    const [first] = scheduler.report().map(({ label }) => label)

    expect(reading.use.mock.calls.length).toBeLessThanOrEqual(first === 'shutdown' ? 0 : 1)
    expect(write.mock.calls).toEqual(reading.use.mock.calls)
    expect(log.warn).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  }))
})

/**
 * Answers a request with the body Open-Meteo returns for `fresh`.
 */
function answer(): Response {
  return Response.json(fresh)
}

function refusal(): Response {
  return new Response(null, { status: 503 })
}

/**
 * Builds a schedule for Delhi whose hourly fetch falls at the second and the
 * minute `draw` holds.
 */
function scheduled(
  fetch   : typeof globalThis.fetch,
  log     : Logging,
  reading : Pick<Reading, 'use'>,
  store   : WindowStore,
  draw    : number[] = [20, 37]
): FetchSchedule {
  const random = vi.fn<(max: number) => number>()

  for (const value of draw) random.mockReturnValueOnce(value)

  return new FetchSchedule(new ForecastClient(fetch), log, delhi, reading, store, random)
}

/**
 * Stands in for `fetch`, answering the request at `index` with `reply(index)`
 * after `delay` milliseconds.
 */
function served(reply: (index: number) => Response, delay = 0): Served {
  const sent: string[] = []
  const fetch          = vi.fn<typeof globalThis.fetch>(async () => {
    const index = sent.push(new Date().toISOString()) - 1

    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))

    return reply(index)
  })

  return { fetch, sent }
}
