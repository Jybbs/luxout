import { defineConfig } from 'knip/config'

export default defineConfig({
  entry              : ['.mise/*/index.ts', 'src/ui/public/index.ts', 'src/ui/server.ts'],
  ignoreBinaries     : ['mise'],
  ignoreDependencies : ['oxlint', 'oxlint-tsgolint', 'publint'],
  project            : ['.mise/**/*.ts', 'src/**/*.ts', 'tests/plugin/**/*.ts'],
  vitest             : { config: ['tests/plugin/vitest.config.ts'] }
})
