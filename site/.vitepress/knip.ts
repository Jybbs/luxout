import { defineConfig } from 'knip/config'

export default defineConfig({
  entry              : ['.vitepress/lib/**/*.data.ts'],
  ignoreDependencies : ['@homebridge/hap-nodejs', 'astronomy-engine', 'oxlint', 'oxlint-tsgolint'],
  vitest             : { config: ['.vitepress/vitest.config.ts'] }
})
