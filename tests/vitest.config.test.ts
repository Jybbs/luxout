import { expect, it, vi } from 'vitest'

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

  const { default: config } = await import('./vitest.config.js')

  expect(config.test?.reporters).toEqual(reporters)
})
