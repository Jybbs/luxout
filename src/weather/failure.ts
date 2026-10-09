type Kind = keyof typeof LINES

const LINES = {
  body    : 'Open-Meteo sent a forecast that fails validation',
  network : 'Open-Meteo could not be reached',
  status  : 'Open-Meteo answered with an error',
  timeout : 'Open-Meteo sent no forecast before the request timed out'
}

/**
 * Names why a request for the forecast returned no window. Its `line` is the
 * one line the caller logs, holding neither the request's address nor the
 * coordinates it carried.
 */
export class FetchFailure {
  readonly kind    : Kind
  readonly #detail : string | undefined

  /**
   * Builds the failure a rejected `fetch` or body read stands for, reading a
   * `TimeoutError` as a timeout, a `SyntaxError` as a body that is not JSON,
   * and anything else as a connection that failed.
   */
  static from(error: unknown): FetchFailure {
    if (error instanceof DOMException && error.name === 'TimeoutError') return new FetchFailure('timeout')
    if (error instanceof SyntaxError) return new FetchFailure('body', 'the body is not JSON')

    return new FetchFailure('network', code(error))
  }

  constructor(kind: Kind, detail?: string) {
    this.kind    = kind
    this.#detail = detail
  }

  get line(): string {
    return this.#detail === undefined ? LINES[this.kind] : `${LINES[this.kind]} (${this.#detail})`
  }
}

function code(error: unknown): string | undefined {
  const cause = error instanceof Error ? error.cause : undefined

  return cause instanceof Error && 'code' in cause && typeof cause.code === 'string' ? cause.code : undefined
}
