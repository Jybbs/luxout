import { defineLoader } from 'vitepress'

import { replaySources }                from '../search/replay.ts'
import { type SettingRow, settingRows } from './rows.ts'

declare const data: SettingRow[]

export { data }

export default defineLoader({
  load  : settingRows,
  watch : replaySources
})
