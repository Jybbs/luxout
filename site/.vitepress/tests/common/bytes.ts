import { readFile, writeFile } from 'node:fs/promises'

import { expect } from 'vitest'

declare module 'vitest' {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
    /**
     * Passes where the file at `path` holds exactly the bytes received,
     * writing them there first where the run updates every snapshot, as
     * `--update=all` does.
     */
    toMatchFileBytes(path: URL): Promise<void>
  }
}

expect.extend({
  async toMatchFileBytes(received: Uint8Array, path: URL) {
    if (this.snapshotState.snapshotUpdateState === 'all') await writeFile(path, received)

    const pass = (await readFile(path)).equals(received)

    return {
      message : () => `${path.pathname} ${pass ? 'holds' : 'no longer holds'} the bytes the site writes`,
      pass    : pass
    }
  }
})
