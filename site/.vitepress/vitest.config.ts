import { dirname } from 'node:path'

import vueJsx           from '@vitejs/plugin-vue-jsx'
import { defineConfig } from 'vitest/config'

import thresholds from '../../tests/coverage.json' with { type: 'json' }

const root = dirname(import.meta.dirname)

export default defineConfig({
  cacheDir : '../.cache/site/vite',
  plugins  : [vueJsx({ tsTransform: 'built-in' })],
  root     : root,
  test     : {
    expect              : { requireAssertions: true },
    forceRerunTriggers  : [import.meta.filename, `${root}/package.json`],
    include             : ['.vitepress/tests/**/*.test.ts'],
    pool                : 'threads',
    resolveSnapshotPath : (testPath, extension) => testPath + extension,
    restoreMocks        : true,
    sequence            : { shuffle: true },
    unstubEnvs          : true,
    unstubGlobals       : true,

    coverage: {
      exclude          : ['**/*.data.ts'],
      include          : ['.vitepress/lib/**/*.ts', '.vitepress/theme/**/*.{ts,tsx}'],
      provider         : 'v8',
      reportOnFailure  : true,
      reportsDirectory : '../.cache/site/coverage',
      thresholds       : thresholds
    },

    reporters: process.env.GITHUB_ACTIONS
             ? ['default', ['github-actions', { jobSummary: { enabled: false } }]]
             : ['default']
  }
})
