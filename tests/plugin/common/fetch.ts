import { vi } from 'vitest'

/**
 * Builds a stand-in `fetch` that answers every request with `response`.
 */
export function answering(response: Response) {
  return vi.fn<typeof fetch>().mockResolvedValue(response)
}
