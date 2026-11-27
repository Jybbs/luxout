import { readFile } from 'node:fs/promises'
import { join }     from 'node:path'

import { expect, it } from 'vitest'
import { parse }      from 'yaml'

import manifest from '../../package.json' with { type: 'json' }
import { root }  from './common/paths.js'

const read = async (file: string) => parse(await readFile(join(root, file), 'utf8'))

it('names in the bug form’s version field the package package.json declares', async () => {
  const { body } = await read('.github/ISSUE_TEMPLATE/bug.yml')

  expect(body.find(({ id }: { id?: string }) => id === 'luxout')?.attributes).toMatchObject({
    description : expect.stringContaining(`\`Loaded plugin: ${manifest.name}@…\``),
    label       : `${manifest.name} version`
  })
})

it('links the release environment to the npm page of the package package.json declares', async () => {
  const { jobs } = await read('.github/workflows/release.yml')

  expect(jobs.publish.environment.url).toBe(`https://www.npmjs.com/package/${manifest.name}`)
})
