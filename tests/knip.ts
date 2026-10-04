import { defineConfig } from 'knip/config'

export default defineConfig({
  ignoreBinaries     : ['mise'],
  ignoreDependencies : ['oxlint', 'oxlint-tsgolint'],
  project            : ['src/**/*.ts', 'tests/**/*.ts'],
  vitest             : { config: ['tests/vitest.config.ts'] }
})
