import { defineConfig } from 'knip/config'

export default defineConfig({
  entry              : ['.vitepress/lib/**/*.data.ts', '.vitepress/lib/bundle/index.ts'],
  ignoreDependencies : [
    '@homebridge/hap-nodejs', 'astronomy-engine', 'homebridge', 'oxlint', 'oxlint-tsgolint'
  ],
  vitest             : { config: ['.vitepress/vitest.config.ts'] }
})
