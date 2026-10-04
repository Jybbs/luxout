import { expect, it, vi } from 'vitest'

import thresholds from './coverage.json' with { type: 'json' }
import config     from './vitest.config.js'

it('fails a case with no assertion, shuffles the order, and undoes every spy and stub', () => {
  expect(config.test).toMatchObject({
    expect        : { requireAssertions: true },
    restoreMocks  : true,
    sequence      : { shuffle: true },
    unstubEnvs    : true,
    unstubGlobals : true
  })
})

it('measures coverage over src/**/*.ts and reports it under .cache/coverage', () => {
  expect(config.test?.coverage).toMatchObject({
    include          : ['src/**/*.ts'],
    reportsDirectory : '.cache/coverage'
  })
})

it('reads the coverage floor from tests/coverage.json', () => {
  expect(config.test?.coverage?.thresholds).toBe(thresholds)
})

it('writes the snapshot file of a case beside its test', () => {
  const { snapshotPath, testFilePath } = expect.getState().snapshotState

  expect(snapshotPath).toBe(`${testFilePath}.snap`)
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
