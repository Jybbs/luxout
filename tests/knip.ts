import { defineConfig } from 'knip/config'

export default defineConfig({
  ignoreBinaries     : ['mise'],
  ignoreDependencies : ['oxlint', 'oxlint-tsgolint'],
  vitest             : { config: ['tests/vitest.config.ts'] }
})
