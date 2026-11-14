import { defineLoader } from 'vitepress'

import { type Identity, readIdentity } from './identity.ts'

declare const data: Identity

export { data }

export default defineLoader({
  load  : () => readIdentity(new URL('../../', import.meta.url)),
  watch : ['../../theme/index.ts', '../../theme/styles/*', '../../../public/logo/*.svg', '../../../index.md']
})
