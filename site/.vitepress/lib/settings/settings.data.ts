import { defineLoader } from 'vitepress'

import { type SettingRow, settingRows } from './rows.ts'

declare const data: SettingRow[]

export { data }

export default defineLoader({
  load  : settingRows,
  watch : ['../../../../config.schema.json', '../search/recording.json']
})
