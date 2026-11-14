import type { Audit } from './audit.ts'
import { Finding }    from './finding.ts'

const BUDGET  = 110
const SOURCES = ['*.cts', '*.mts', '*.ts', '*.tsx']
/**
 * Matches a row holding one regular expression literal or one quoted glob and
 * nothing else but the commas, semicolons, and parentheses closing its call.
 */
const WHOLE     = /^(?:\/(?![*/])(?:\\.|[^\\/])+\/[dgimsuvy]*|(['"`])[^\s'"`]*[*?{][^\s'"`]*\1)[,;)]*$/
const segmenter = new Intl.Segmenter('en')

/**
 * Holds every tracked TypeScript file to the 110-character line budget, leaving
 * out a row that holds nothing but one regular expression or one glob, which no
 * wrap can split.
 */
export class LineBudget {
  readonly #files: Record<string, string>

  static read(audit: Audit): LineBudget {
    return new LineBudget(audit.tracked(...SOURCES))
  }

  constructor(files: Record<string, string>) {
    this.#files = files
  }

  /**
   * Counts each line in the characters a reader sees, as `Intl.Segmenter`
   * splits them, so a typographic apostrophe or an emoji counts once.
   */
  get findings(): Finding[] {
    return Object.entries(this.#files).flatMap(([file, text]) => text.split('\n').flatMap((row, index) => {
      const length = row.length > BUDGET ? Array.from(segmenter.segment(row)).length : row.length

      return length <= BUDGET || WHOLE.test(row.trim()) ? [] : [new Finding(
        `The line runs ${length} characters, past the ${BUDGET}-character budget`,
        { file, line: index + 1 },
        'Line length'
      )]
    }))
  }
}
