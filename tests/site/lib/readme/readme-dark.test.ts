/** @module-tag records */
import { expect, it } from 'vitest'

import { DayPreview, previewAddress } from '../../../../site/.vitepress/lib/readme/day-preview.ts'
import { dialDrawing } from '../../../../site/.vitepress/theme/components/daylight/dial-drawing.tsx'
import { vitepress }                  from '../../common/paths.ts'
import '../../common/bytes.ts'

const preview = await DayPreview.read(vitepress, dialDrawing)

it('holds the dark preview in the tracked README files as the site records it', async () => {
  await expect(await preview.record('dark'))
    .toMatchFileBytes(new URL(`../public${previewAddress('dark')}`, vitepress))
})
