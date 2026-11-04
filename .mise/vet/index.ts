import { Vet } from './vet.ts'

const vet        = await Vet.read(process.argv.slice(2), process.cwd())
process.exitCode = await vet.run()
