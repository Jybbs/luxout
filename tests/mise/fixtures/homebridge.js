import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer }                              from 'node:net'
import { join }                                      from 'node:path'
import { parseArgs }                                 from 'node:util'

const { values } = parseArgs({
  options: {
    'no-qrcode'                : { short: 'Q', type: 'boolean' },
    'plugin-path'              : { short: 'P', type: 'string' },
    'strict-plugin-resolution' : { type: 'boolean' },
    'user-storage-path'        : { short: 'U', type: 'string' }
  }
})

const storage  = values['user-storage-path'] ?? ''
const file     = (name) => join(storage, name)
const acts     = existsSync(file('acts.json')) ? JSON.parse(readFileSync(file('acts.json'), 'utf8')) : {}
const config   = JSON.parse(readFileSync(file('config.json'), 'utf8'))
const marker   = file('started')
const again    = existsSync(marker)
const block    = config.platforms[0]
const conflict = `Error: listen EADDRINUSE: address already in use :::${config.bridge.port}`

writeFileSync(marker, '')
setInterval(() => {}, 60_000)
process.on('SIGTERM', () => acts.lingers || process.exit(0))
console.log(`Started with ${process.argv.slice(2).join(' ')}`)
console.log(`Preloaded with ${process.execArgv.join(' ')}`)

if ((block && !acts.silent) || acts.initializes) console.log('Initializing Luxout platform...')
if (acts.logs) console.error(acts.logs)
if (acts.writes) writeFileSync(acts.writes, '')
if (acts.fetches) await fetch(acts.fetches).catch(({ cause }) => console.error('Fetch failed:', cause?.code))

if (acts.conflicts && again) {
  console.error(conflict)
  process.exit(143)
}

if (!acts.mute) {
  createServer().listen(config.bridge.port, () => {
    console.log(`Homebridge v9.9.9 (${config.bridge.name}) is running on port ${config.bridge.port}.`)

    if (acts.exits) process.exit(1)
    if (acts.conflictsLate && again) setTimeout(() => console.error(conflict), 20)
  })
}
