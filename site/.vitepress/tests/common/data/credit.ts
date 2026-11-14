import { pathToFileURL } from 'node:url'

import { Seal } from '../../../lib/credit/seal.ts'

/**
 * What `credit.data.ts` yields under a build, for a case to mock it with,
 * since only VitePress runs a loader. The root comes from the module's own
 * directory, because Vite rewrites a URL built on `import.meta.url` to an
 * address on its server in a DOM environment.
 */
export const data = (await Seal.read(pathToFileURL(`${import.meta.dirname}/../../../`))).marks
