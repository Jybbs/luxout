import { Vet } from '../../../.mise/vet/vet.ts'

const vet        = await Vet.read(process.argv.slice(2), process.cwd(), JSON.parse(process.env.TUNING))
process.exitCode = await vet.run()
