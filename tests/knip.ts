import { defineConfig } from 'knip/config'

export default defineConfig({
  entry              : ['.mise/audit/index.ts', 'src/ui/public/index.ts', 'src/ui/server.ts'],
  ignoreBinaries     : ['mise'],
  ignoreDependencies : ['oxlint', 'oxlint-tsgolint', 'publint'],
  project            : ['.mise/audit/**/*.ts', 'src/**/*.ts', 'tests/**/*.ts'],
  vitest             : { config: ['tests/vitest.config.ts'] }
})
