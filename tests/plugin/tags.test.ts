import { expect, it } from 'vitest'

it('runs an untagged case under Vitest’s 5 s default', ({ task }) => {
  expect(task.timeout).toBe(5000)
})

it('runs a case tagged spawns under 60 s', { tags: ['spawns'] }, ({ task }) => {
  expect(task.timeout).toBe(60_000)
})

it('runs a case tagged spawns-many under 180 s', { tags: ['spawns-many'] }, ({ task }) => {
  expect(task.timeout).toBe(180_000)
})
