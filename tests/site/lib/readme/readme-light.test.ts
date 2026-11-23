/** @module-tag records */
import { expect, it } from 'vitest'

import { DayPreview, previewAddress } from '../../../../site/.vitepress/lib/readme/day-preview.ts'
import { dialDrawing } from '../../../../site/.vitepress/theme/components/daylight/dial-drawing.tsx'
import '../../common/bytes.ts'

const root    = new URL('../../../../site/.vitepress/', import.meta.url)
const preview = await DayPreview.read(root, dialDrawing)

it('holds the light preview in the tracked README files as the site records it', async () => {
  await expect(await preview.record('light'))
    .toMatchFileBytes(new URL(`../public${previewAddress('light')}`, root))
})
