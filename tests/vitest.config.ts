import { dirname } from 'node:path'

import { convertPathToPattern } from 'tinyglobby'
import { defineConfig }         from 'vitest/config'

import thresholds from './coverage.json' with { type: 'json' }

const root = dirname(import.meta.dirname)

export default defineConfig({
  cacheDir : '.cache/vite',
  root     : root,
  test     : {
    environmentOptions  : { happyDOM: { settings: { handleDisabledFileLoadingAsSuccess: true } } },
    expect              : { requireAssertions: true },
    forceRerunTriggers  : [import.meta.filename, `${convertPathToPattern(root)}/{,!(site)/**/}package.json`],
    include             : ['tests/**/*.test.ts'],
    resolveSnapshotPath : (testPath, extension) => testPath + extension,
    restoreMocks        : true,
    sequence            : { shuffle: true },
    unstubEnvs          : true,
    unstubGlobals       : true,

    coverage: {
      include          : ['.mise/**/*.ts', 'src/**/*.ts'],
      provider         : 'v8',
      reportOnFailure  : true,
      reportsDirectory : '.cache/coverage',
      thresholds       : thresholds
    },

    reporters: process.env.GITHUB_ACTIONS
             ? ['default', ['github-actions', { jobSummary: { enabled: false } }]]
             : ['default'],

    tags: [
      {
        description : 'Runs a task, a wrapper, or a stand-in as a child process',
        name        : 'spawns',
        timeout     : 60_000
      },
      {
        description : 'Runs a task that clones a checkout, packs the package, or installs Homebridge',
        name        : 'spawns-many',
        timeout     : 180_000
      }
    ]
  }
})
