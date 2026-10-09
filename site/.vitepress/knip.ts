import { defineConfig } from 'knip/config'

export default defineConfig({
  ignoreDependencies : ['oxlint', 'oxlint-tsgolint'],
  vitest             : { config: ['.vitepress/vitest.config.ts'] }
})
