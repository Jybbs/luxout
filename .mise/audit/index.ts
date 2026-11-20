import { Audit } from './audit.ts'

process.exitCode = await new Audit(process.cwd()).report()
