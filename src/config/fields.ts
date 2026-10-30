import * as v from '@badrap/valita'

const conjunction = new Intl.ListFormat('en', { type: 'conjunction' })

/**
 * Accepts a number inside the bounds a field of `config.schema.json` declares.
 */
export function bounded({ maximum, minimum }: { maximum: number, minimum: number }): v.Type<number> {
  return v.number().assert((value) => minimum <= value && value <= maximum)
}

/**
 * Joins the key each issue of a failed parse names into one English list.
 */
export function keysAtFault({ issues }: v.Err): string {
  return conjunction.format(issues.map(({ path }) => path.join('.')))
}
