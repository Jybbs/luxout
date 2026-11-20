/**
 * The tags `tests/vitest.config.ts` declares, by name, each lifting Vitest's
 * 5-second limit for a case that runs child processes.
 */
export const TAGS = {
  'spawns'      : { description: 'Runs a task, a wrapper, or a stand-in as a child process', timeout: 60_000 },
  'spawns-many' : {
    description : 'Runs a task that clones a checkout, packs the package, or installs Homebridge',
    timeout     : 180_000
  }
}
