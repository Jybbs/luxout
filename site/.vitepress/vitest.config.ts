import { dirname, join } from 'node:path'

import vueJsx           from '@vitejs/plugin-vue-jsx'
import { defineConfig } from 'vitest/config'

import { thresholds }             from '../../tests/common/coverage.ts'
import { changedFiles, triggers } from '../../tests/common/triggers.ts'

const INCLUDE = ['.vitepress/tests/**/*.test.ts']
const PATHS   = ['.mise/config.toml', '.mise/mise.lock']
const root    = dirname(import.meta.dirname)
const read    = PATHS.map((file) => join(dirname(root), file))

export default defineConfig({
  cacheDir : '../.cache/site/vite',
  plugins  : [vueJsx({ tsTransform: 'built-in' })],
  root     : root,
  test     : {
    expect              : { requireAssertions: true },
    experimental        : { vcsProvider: changedFiles(INCLUDE) },
    forceRerunTriggers  : [import.meta.filename, ...triggers(root, INCLUDE), ...read],
    fsModuleCachePath   : '../.cache/site/vitest',
    include             : INCLUDE,
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
      thresholds       : thresholds()
    },

    reporters: process.env.GITHUB_ACTIONS
             ? ['default', ['github-actions', { jobSummary: { enabled: false } }]]
             : ['default'],

    tags: [
      {
        description : 'Draws a card through resvg',
        name        : 'draws',
        timeout     : 60_000
      },
      {
        description : 'Records the README preview, frame by frame',
        name        : 'records',
        timeout     : 600_000
      },
      {
        description : 'Runs a script as a child process',
        name        : 'spawns',
        timeout     : 30_000
      }
    ]
  }
})
