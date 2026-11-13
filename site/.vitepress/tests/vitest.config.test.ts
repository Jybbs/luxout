import type { Plugin, UserConfig } from 'vite'
import { expect, it, vi }          from 'vitest'

import thresholds from '../../../tests/coverage.json' with { type: 'json' }
import config     from '../vitest.config.ts'

it('holds the site to the coverage floor the plugin suite reads', () => {
  expect(config.test?.coverage?.thresholds).toBe(thresholds)
})

it('compiles the theme’s TSX through Vue’s JSX plugin, leaving its types to Vite’s own transform', () => {
  const jsx  = config.plugins?.[0] as Plugin
  const hook = jsx.config as (this: object, config: UserConfig) => UserConfig

  expect(jsx.name).toBe('vite:vue-jsx')
  expect(hook.call({ meta: { rolldownVersion: '' } }, {}).oxc).toEqual({ exclude: /\.jsx?$/ })
})

it('measures coverage over lib/ and theme/, less the loader shells', () => {
  expect(config.test?.coverage).toMatchObject({
    exclude : ['**/*.data.ts'],
    include : ['.vitepress/lib/**/*.ts', '.vitepress/theme/**/*.{ts,tsx}']
  })
})

it('keeps the Vite cache and the coverage report under the .cache directory at the root', () => {
  expect([config.cacheDir, config.test?.coverage?.reportsDirectory])
    .toEqual(['../.cache/site/vite', '../.cache/site/coverage'])
})

it('runs each test file on a worker thread of its own', () => {
  expect(config.test?.pool).toBe('threads')
})

it('fails a case with no assertion, shuffles the order, and undoes every spy and stub', () => {
  expect(config.test).toMatchObject({
    expect        : { requireAssertions: true },
    restoreMocks  : true,
    sequence      : { shuffle: true },
    unstubEnvs    : true,
    unstubGlobals : true
  })
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

  const { default: fresh } = await import('../vitest.config.ts')

  expect(fresh.test?.reporters).toEqual(reporters)
})
