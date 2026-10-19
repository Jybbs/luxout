import { spawnSync }       from 'node:child_process'
import { cp }              from 'node:fs/promises'
import { delimiter, join } from 'node:path'

import { expect } from 'vitest'

import { test } from '../../../common/scratch.js'

const printer = join(import.meta.dirname, '..', '..', 'fixtures', 'args.sh')
const task    = join(import.meta.dirname, '..', '..', '..', '..', '.mise', 'tasks', 'plugin', 'watch')

test('restarts plugin:run under mise watch on each change, forwarding every further argument', async ({
  scratch
}) => {
  const bin = join(scratch, 'bin')

  await cp(printer, join(bin, 'mise'))

  const { status, stdout } = spawnSync(task, ['-T', 'holds a space'], {
    cwd      : scratch,
    encoding : 'utf8',
    env      : { PATH: bin + delimiter + process.env.PATH }
  })

  expect({ status, stdout: stdout.split('\0').slice(0, -1) }).toEqual({
    status : 0,
    stdout : [join(bin, 'mise'), 'watch', '--restart', 'plugin:run', '-T', 'holds a space']
  })
})
