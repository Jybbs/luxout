import { vi } from 'vitest'

/**
 * Stubs `matchMedia` with a list that matches each query `matches` holds for
 * and takes listeners as a browser's list does.
 */
export function stubMedia(matches: (query: string) => boolean): void {
  vi.stubGlobal('matchMedia', (query: string) =>
    Object.assign(new EventTarget(), { matches: matches(query), media: query })
  )
}
