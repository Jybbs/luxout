import { settingRows } from '../../../lib/settings/rows.ts'

/**
 * What `settings.data.ts` yields under a build, for a case to mock it with,
 * since only VitePress runs a loader.
 */
export const data = await settingRows()
