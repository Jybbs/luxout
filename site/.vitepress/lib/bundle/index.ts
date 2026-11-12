import { Bundle } from './bundle.ts'

process.exitCode = await Bundle.read(process.cwd()).report()
