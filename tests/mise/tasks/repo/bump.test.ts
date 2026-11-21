/** @module-tag spawns */
import { readFile } from 'node:fs/promises'
import { join }     from 'node:path'

import { describe } from 'vitest'

import { repository }  from '../../../common/repository.js'
import { plant, test } from '../../../common/scratch.js'
import { info, sync }  from '../../../common/sync.js'

const MANIFEST = `${JSON.stringify({ name: 'luxout', version: '0.1.0' }, null, 2)}\n`

/**
 * Runs the task with `args` in `scratch`, a repository whose one commit holds a
 * `package.json` declaring `0.1.0`, and reads back the version it leaves, the
 * commits the repository holds, and its tags.
 */
async function bump(scratch: string, args: string[] = []) {
  const git = repository(scratch)

  await plant(scratch, { 'package.json': MANIFEST })
  git('add', 'package.json')
  git('commit', '--message', '0.1.0', '--quiet')

  const { status, stderr, stdout } = await sync(scratch, 'repo:bump', {
    args : args,
    env  : { NPM_CONFIG_CACHE: join(scratch, 'tmp', 'npm') }
  })
  const { version } = JSON.parse(await readFile(join(scratch, 'package.json'), 'utf8'))

  return {
    commits : git('rev-list', '--count', 'HEAD').trim(),
    status  : status,
    stderr  : stderr,
    stdout  : stdout,
    tags    : git('tag', '--list').trim(),
    version : version
  }
}

describe.concurrent('repo:bump', () => {
  test('runs as `mise bump`', async ({ expect }) => {
    expect(await info('repo:bump')).toMatchObject({ aliases: ['bump'] })
  })

  test.for([
    { args: [], part: 'minor', version: '0.2.0' },
    { args: ['--patch'], part: 'patch', version: '0.1.1' },
    { args: ['--major'], part: 'major', version: '1.0.0' }
  ])('moves the version to the next $part release with no commit or tag', async ({ args, version }, {
    expect,
    scratch
  }) => {
    expect(await bump(scratch, args)).toEqual({
      commits : '1',
      status  : 0,
      stderr  : '',
      stdout  : `v${version}\n`,
      tags    : '',
      version : version
    })
  })

  test.for(['--minor', '--major --patch'])(
    'fails leaving the version where it stands on `%s`',
    async (flags, { expect, scratch }) => {
      expect(await bump(scratch, flags.split(' '))).toMatchObject({
        status  : 2,
        stderr  : `\`${flags}\` is no flag \`repo:bump\` takes, which are \`--major\` and \`--patch\`\n`,
        version : '0.1.0'
      })
    }
  )
})
