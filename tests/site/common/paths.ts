import { join } from 'node:path'

import { root } from '../../plugin/common/paths.ts'

/**
 * The site's directory in the repository the suite runs in.
 */
export const site = join(root, 'site')

/**
 * The site's `.vitepress` directory, as a file URL.
 */
export const vitepress = new URL('../../../site/.vitepress/', import.meta.url)
