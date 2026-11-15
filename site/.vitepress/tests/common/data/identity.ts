import { pathToFileURL } from 'node:url'

import { readIdentity } from '../../../lib/identity/identity.ts'

/**
 * What `identity.data.ts` yields under a build, for a case to mock it with,
 * since only VitePress runs a loader.
 */
export const data = await readIdentity(pathToFileURL(`${import.meta.dirname}/../../../`))
