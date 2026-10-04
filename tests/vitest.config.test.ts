import { expect, it, vi } from 'vitest'

import config from './vitest.config.js'

it('fails a case with no assertion, shuffles the order, and undoes every spy and stub', () => {
  expect(config.test).toMatchObject({
    expect        : { requireAssertions: true },
    restoreMocks  : true,
    sequence      : { shuffle: true },
    unstubEnvs    : true,
    unstubGlobals : true
  })
})

it('holds coverage over src/**/*.ts at 95% on every measure, reported under .cache/', () => {
  expect(config.test?.coverage).toMatchObject({
    include          : ['src/**/*.ts'],
    reportsDirectory : '.cache/coverage',
    thresholds       : { branches: 95, functions: 95, lines: 95, statements: 95 }
  })
})

it.each([
  {
    actions   : 'true',
    name      : 'annotates a failure and writes no job summary under GitHub Actions',
    reporters : ['default', ['github-actions', { jobSummary: { enabled: false } }]]
  },
  {
    actions   : undefined,
    name      : 'reports through the default reporter alone outside GitHub Actions',
    reporters : ['default']
  }
])('$name', async ({ actions, reporters }) => {
  vi.stubEnv('GITHUB_ACTIONS', actions)
  vi.resetModules()

  const { default: fresh } = await import('./vitest.config.js')

  expect(fresh.test?.reporters).toEqual(reporters)
})
