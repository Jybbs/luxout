import { dirname } from 'node:path'

import { defineConfig } from 'vitest/config'

import thresholds from './coverage.json' with { type: 'json' }

export default defineConfig({
  cacheDir : '.cache/vite',
  root     : dirname(import.meta.dirname),
  test     : {
    expect              : { requireAssertions: true },
    include             : ['tests/**/*.test.ts'],
    resolveSnapshotPath : (testPath, extension) => testPath + extension,
    restoreMocks        : true,
    sequence            : { shuffle: true },
    unstubEnvs          : true,
    unstubGlobals       : true,

    coverage: {
      include          : ['.mise/audit/**/*.ts', 'src/**/*.ts'],
      provider         : 'v8',
      reportOnFailure  : true,
      reportsDirectory : '.cache/coverage',
      thresholds       : thresholds
    },

    reporters: process.env.GITHUB_ACTIONS
             ? ['default', ['github-actions', { jobSummary: { enabled: false } }]]
             : ['default']
  }
})
