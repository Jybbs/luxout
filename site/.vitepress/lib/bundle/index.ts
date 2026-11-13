import { Bundle } from './bundle.ts'

process.exitCode = await (await Bundle.read(process.cwd())).report()
