import { expect, it } from 'vitest'

import { Card }  from '../../../lib/cards/card.ts'
import { Faces } from '../../../lib/cards/faces.ts'
import * as room from '../../../lib/cards/room.ts'

const faces = await Faces.read(new URL('../../../', import.meta.url))
const scene = new room.Room(new Card(faces, '#1a1a1a'), '#1a1a1a', '#f2f1ee')

it('projects a nearer point further from the middle of the view', () => {
  const far  = room.at([1, 0, 0])
  const near = room.at([1, 0, 3])

  expect(near[0]).toBeGreaterThan(far[0])
  expect(near[1]).toBeGreaterThan(far[1])
})

it('sends a southern noon sun north and down, with no sideways travel', () => {
  const [x, y, z] = room.travelOf(45, 180)

  expect(x).toBeCloseTo(0, 6)
  expect(y).toBeCloseTo(-Math.SQRT1_2, 6)
  expect(z).toBeCloseTo(Math.SQRT1_2, 6)
})

it('sends an afternoon sun in the west toward the east wall', () => {
  expect(room.travelOf(30, 240)[0]).toBeLessThan(0)
})

it.each([0, 1, 2, 3, 4, 5])('keeps the bars’ gaps around pane %i', (index) => {
  const { x0, x1, y0, y1 } = scene.pane(index)

  expect(x1 - x0).toBeCloseTo(1 - 0.08, 6)
  expect(y1 - y0).toBeCloseTo(2.15 / 2 - 0.08, 6)
})

it.each([0, 1, 2, 3, 4, 5])('holds pane %i inside the window drawn on the card', (index) => {
  const { height, width, x, y } = scene.glazed
  const pane                    = scene.flatPane(index)

  expect(pane.x).toBeGreaterThanOrEqual(x)
  expect(pane.y).toBeGreaterThanOrEqual(y)
  expect(pane.x + pane.width).toBeLessThanOrEqual(x + width + 1e-9)
  expect(pane.y + pane.height).toBeLessThanOrEqual(y + height + 1e-9)
})

it('holds a cast inside the floor and the side wall it reaches', () => {
  const cast = scene.cast(scene.pane(2), room.travelOf(20, 250))
  const all  = cast.flat()

  expect(cast.length).toBeGreaterThan(0)
  expect(all.every(([x, y, z]) =>
       Math.abs(x) <= 5.2 + 1e-9
    && y >= -1e-9
    && y <= 3.6 + 1e-9
    && z >= -1e-9
    && z <= 3.7 + 1e-9
  )).toBe(true)
})

it('cuts a cast where it crosses the room’s open side', () => {
  const [floor] = scene.cast(scene.pane(0), [0, -1, 1.5])
  const depths  = floor!.map(([, , z]) => z)

  expect(Math.max(...depths)).toBeCloseTo(3.7, 6)
  expect(Math.min(...depths)).toBeLessThan(3.7)
})

it('casts on the floor alone where the light has no sideways travel', () => {
  expect(scene.cast(scene.pane(0), [0, -1, 0.2])).toHaveLength(1)
})

it('casts nothing where the light misses every surface', () => {
  expect(scene.cast(scene.pane(0), [0, -0.01, 1])).toEqual([])
})

it('places the soft patch of a low sun under its pane on the card', () => {
  const pane   = scene.pane(0)
  const [x, y] = room.at([(pane.x0 + pane.x1) / 2, (pane.y0 + pane.y1) / 2, 0])
  const shapes = scene.cast(pane, scene.under(pane))
  const points = shapes[0]!.map(room.at)
  const middle = points.reduce((sum, [px]) => sum + px, 0) / points.length

  expect(Math.abs(middle - x)).toBeLessThan(40)
  expect(Math.min(...points.map(([, py]) => py))).toBeGreaterThan(y)
})
