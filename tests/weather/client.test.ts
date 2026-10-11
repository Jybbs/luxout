import { expect, it, vi } from 'vitest'

import { Place }          from '../../src/config/place.js'
import { ForecastClient } from '../../src/weather/client.js'
import { parsed }         from '../common/window.js'
import forecast           from './fixtures/forecast.json' with { type: 'json' }

const ADDRESS = 'https://api.open-meteo.com/v1/forecast'
              + '?forecast_minutely_15=24&latitude=42.36&longitude=-71.06'
              + '&minutely_15=shortwave_radiation_instant&past_minutely_15=4&timeformat=unixtime'
const REFUSAL = {
  error  : true,
  reason : 'Cannot initialize WeatherVariable from invalid String value tempeture_2m for key hourly'
}
const place = new Place(42.35843, -71.05977)

it('requests each 15-minute step from an hour back to six hours ahead, with no key', async () => {
  const fetch = answering(Response.json(forecast))

  await new ForecastClient(fetch).fetch(place)

  expect(fetch).toHaveBeenCalledExactlyOnceWith(ADDRESS, { signal: expect.any(AbortSignal) })
})

it('returns the window Open-Meteo sends for the place', async () => {
  const window = await new ForecastClient(answering(Response.json(forecast))).fetch(place)

  expect(window).toEqual(parsed(forecast, place))
})

it('sends each request through the global fetch unless it is given another', async () => {
  const fetch = answering(Response.json(forecast))

  vi.stubGlobal('fetch', fetch)
  await new ForecastClient().fetch(place)

  expect(fetch).toHaveBeenCalledOnce()
})

it('reads the steps and the timeout from the tuning record it receives', async () => {
  const fetch   = answering(Response.json(forecast))
  const timeout = vi.spyOn(AbortSignal, 'timeout')

  await new ForecastClient(fetch, { forecast: 8, past: 2, timeout: 5000 }).fetch(place)

  expect(fetch.mock.calls[0]?.[0]).toMatch(/forecast_minutely_15=8&.*&past_minutely_15=2&/)
  expect(timeout).toHaveBeenCalledExactlyOnceWith(5000)
})

it('bounds each request by a timeout of 10 seconds', async () => {
  const timeout = vi.spyOn(AbortSignal, 'timeout')

  await new ForecastClient(answering(Response.json(forecast))).fetch(place)

  expect(timeout).toHaveBeenCalledExactlyOnceWith(10_000)
})

it('reports a request that times out as a timeout', async () => {
  vi.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort(new DOMException('', 'TimeoutError')))

  const failure = await new ForecastClient(hanging()).fetch(place)

  expect(failure).toMatchObject({
    kind : 'timeout',
    line : 'Open-Meteo sent no forecast before the request timed out'
  })
})

it.each([
  { fetch: hanging(), name: 'the request in flight' },
  { fetch: answering(Response.json(forecast)), name: 'a forecast that has already arrived' }
])('returns nothing once the caller aborts $name', async ({ fetch }) => {
  const controller = new AbortController()
  const pending    = new ForecastClient(fetch).fetch(place, controller.signal)

  controller.abort()

  await expect(pending).resolves.toBeUndefined()
})

it.each([
  {
    fetch : vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed', { cause: unreachable() })),
    line  : 'Open-Meteo could not be reached (ENOTFOUND)',
    name  : 'a host that does not resolve'
  },
  {
    fetch : answering(Response.json(REFUSAL, { status: 400 })),
    line  : 'Open-Meteo answered with an error (status 400, Cannot initialize WeatherVariable '
          + 'from invalid String value tempeture_2m for key hourly)',
    name  : 'a status Open-Meteo gives a reason for'
  },
  {
    fetch : answering(new Response('<html>Bad Gateway</html>', { status: 502 })),
    line  : 'Open-Meteo answered with an error (status 502)',
    name  : 'a status that comes with no reason'
  },
  {
    fetch : answering(new Response('<html>OK</html>')),
    line  : 'Open-Meteo sent a forecast that fails validation (the body is not JSON)',
    name  : 'a body that is not JSON'
  },
  {
    fetch : answering(Response.json({ minutely_15: { ...forecast.minutely_15, time: [] } })),
    line  : 'Open-Meteo sent a forecast that fails validation '
          + '(custom_error at .minutely_15 (the step times and the irradiances differ in length))',
    name  : 'a body that fails validation'
  }
])('reports $name in one line naming neither the address nor the coordinates', async ({ fetch, line }) => {
  const failure = await new ForecastClient(fetch).fetch(place)

  expect(failure).toMatchObject({ line })
  expect(failure).toMatchObject({ line: expect.not.stringMatching(/open-meteo\.com|42\.36|71\.06/) })
})

function answering(response: Response) {
  return vi.fn<typeof fetch>().mockResolvedValue(response)
}

function hanging() {
  return vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.throwIfAborted()
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
  }))
}

function unreachable(): Error {
  return Object.assign(new Error('getaddrinfo ENOTFOUND api.open-meteo.com'), { code: 'ENOTFOUND' })
}
