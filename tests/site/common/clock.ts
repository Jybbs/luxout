import { test as base, vi } from 'vitest'

/**
 * Stops the clock before each case and starts it again once the case ends.
 */
export const test = base.extend('clock', { auto: true }, ({ onTestFinished }) => {
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
})
