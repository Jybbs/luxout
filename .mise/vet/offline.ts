import dns                       from 'node:dns'
import { syncBuiltinESMExports } from 'node:module'

import { failLookups } from './monitor.ts'

failLookups(dns)
syncBuiltinESMExports()
