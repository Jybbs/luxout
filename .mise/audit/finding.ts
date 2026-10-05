/**
 * The file and line a finding concerns.
 */
export interface Spot {
  file : string
  line : number
}

const MESSAGE  = /[%\r\n]/g
const PROPERTY = /[%\r\n:,]/g

/**
 * A divergence one check reports against the file and line it concerns.
 */
export class Finding {
  readonly message : string
  readonly spot    : Spot
  readonly title   : string

  constructor(message: string, { file, line }: Spot, title: string) {
    this.message = message
    this.spot    = { file, line }
    this.title   = title
  }

  /**
   * Formats the finding as the `::error` workflow command GitHub Actions reads,
   * percent-encoding `%`, `\r`, and `\n` in the message, and those with `:` and
   * `,` in each property, as the `@actions/core` toolkit encodes them.
   */
  get annotation(): string {
    const file    = this.spot.file.replaceAll(PROPERTY, encodeURIComponent)
    const message = this.message.replaceAll(MESSAGE, encodeURIComponent)
    const title   = this.title.replaceAll(PROPERTY, encodeURIComponent)

    return `::error file=${file},line=${this.spot.line},title=${title}::${message}`
  }
}
