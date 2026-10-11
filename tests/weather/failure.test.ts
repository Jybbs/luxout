import { expect, it } from 'vitest'

import { FetchFailure } from '../../src/weather/failure.js'

const refused = Object.assign(new Error('connect ECONNREFUSED 104.21.32.1:443'), { code: 'ECONNREFUSED' })

it.each([
  {
    error : new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
    kind  : 'timeout',
    line  : 'Open-Meteo sent no forecast before the request timed out',
    name  : 'a timeout'
  },
  {
    error : new SyntaxError('Unexpected token \'<\', "<html>" is not valid JSON'),
    kind  : 'body',
    line  : 'Open-Meteo sent a forecast that fails validation (the body is not JSON)',
    name  : 'a body that is not JSON'
  },
  {
    error : new TypeError('fetch failed', { cause: refused }),
    kind  : 'network',
    line  : 'Open-Meteo could not be reached (ECONNREFUSED)',
    name  : 'a connection refused'
  },
  {
    error : new TypeError('fetch failed', { cause: new Error('bad port') }),
    kind  : 'network',
    line  : 'Open-Meteo could not be reached',
    name  : 'a cause carrying no code'
  },
  {
    error : new TypeError('fetch failed'),
    kind  : 'network',
    line  : 'Open-Meteo could not be reached',
    name  : 'a rejection carrying no cause'
  },
  {
    error : 'refused',
    kind  : 'network',
    line  : 'Open-Meteo could not be reached',
    name  : 'a rejection that is not an error'
  }
])('renders $name as the line $line', ({ error, kind, line }) => {
  expect(FetchFailure.from(error)).toMatchObject({ kind, line })
})

it('renders a status and the reason Open-Meteo gives for it', () => {
  expect(new FetchFailure('status', 'status 429, Minutely API request limit exceeded').line)
    .toBe('Open-Meteo answered with an error (status 429, Minutely API request limit exceeded)')
})
