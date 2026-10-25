import fs                        from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'

import { Writes } from './monitor.ts'

new Writes(process.env.HB_STORAGE_PATH ?? process.cwd()).watch(fs)
syncBuiltinESMExports()
