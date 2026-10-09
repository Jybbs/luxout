import { Audit } from './audit.ts'

process.exitCode = new Audit(process.cwd()).report()
