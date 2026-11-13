import { defineConfig } from 'knip/config'

export default defineConfig({
  vitest: { config: ['.vitepress/vitest.config.ts'] },

  entry: [
    '.vitepress/lib/**/*-frame.css', '.vitepress/lib/**/*.data.ts', '.vitepress/lib/bundle/index.ts'
  ],

  ignoreDependencies: [
    '@homebridge/hap-nodejs', 'astronomy-engine', 'homebridge', 'oxlint', 'oxlint-tsgolint'
  ]
})
