import type { Entry, Key, YamlFile } from './files.ts'
import { Finding }                   from './finding.ts'

const PIN     = /^(?<action>[^/@]+\/[^/@]+)[^@]*@(?<ref>.+)$/
const SUMMARY = 'GITHUB_STEP_SUMMARY'

export class Step {
  readonly #file : YamlFile
  readonly #path : Key[]

  static list(file: YamlFile, ...path: Key[]): Step[] {
    return file.items(...path).map((_, index) => new Step(file, [...path, index]))
  }

  constructor(file: YamlFile, path: Key[]) {
    this.#file = file
    this.#path = path
  }

  get findings(): Finding[] {
    const run = this.#file.at(...this.#path, 'run')

    return run && String(run.value).includes(SUMMARY) ? [new Finding(
      'The step writes the step summary, which only a workflow’s gate writes',
      run,
      'Step summary'
    )] : []
  }

  get inputs(): Entry[] {
    return this.#file.keys(...this.#path, 'with')
  }

  get uses(): Entry | undefined {
    return this.#file.at(...this.#path, 'uses')
  }
}

/**
 * Holds each action outside the repository to one commit across every file
 * naming it, keyed by its owner and repository, and rejects a comment trailing
 * a pin.
 */
export function pinned(uses: Entry[]): Finding[] {
  const pins = uses.flatMap((entry) => {
    const { action, ref } = PIN.exec(String(entry.value))?.groups ?? {}

    return action && ref ? [{ ...entry, action, ref }] : []
  })

  const drifts = Map.groupBy(pins, (pin) => pin.action)
    .values()
    .flatMap(([first, ...rest]) => rest.filter((pin) => pin.ref !== first?.ref).map((pin) => new Finding(
      `\`${pin.action}\` pins ${pin.ref}, whereas ${first?.file}:${first?.line} pins ${first?.ref}`,
      pin,
      'Action pin'
    )))

  return [
    ...pins
      .filter((pin) => pin.comment)
      .map((pin) => new Finding(
        `\`${String(pin.value)}\` is followed by the comment \`${pin.comment?.trim()}\`, `
      + 'which nothing holds to the commit',
        pin,
        'Action pin'
      )),
    ...drifts
  ]
}
