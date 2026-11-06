import { type VNode, h } from 'vue'

import { tenth } from '../../lib/daylight/tenth.ts'

interface WordStyle {
  readonly anchor? : 'end' | 'middle'
  readonly name?   : string
  readonly size?   : number
}

/**
 * Draws a plot as a standalone SVG, one image to the accessibility tree under
 * `label`, with the namespace a frame file needs once an `img` shows it.
 */
export function plotDrawing(
  name     : string,
  label    : string,
  width    : number,
  height   : number,
  children : VNode[]
): VNode {
  return h(
    'svg',
    {
      'aria-label' : label,
      class        : name,
      role         : 'img',
      viewBox      : `0 0 ${width} ${height}`,
      xmlns        : 'http://www.w3.org/2000/svg'
    },
    children
  )
}

/**
 * Draws a plot's marks as an SVG stretched across the element holding it, each
 * unit of `width` and `height` scaling to that element, and hidden from the
 * accessibility tree.
 */
export function plotMarks(name: string, width: number, height: number, children: VNode[]): VNode {
  return h(
    'svg',
    { 'aria-hidden': true, class: name, preserveAspectRatio: 'none', viewBox: `0 0 ${width} ${height}` },
    children
  )
}

/**
 * Builds the function a drawing writes its words through, each word an SVG
 * `text` centered on `y` in the class `plain` unless its style names another.
 */
export function plotWords(plain: string) {
  return (
    text                           : number | string,
    x                              : number,
    y                              : number,
    { anchor, name = plain, size } : WordStyle = {}
  ): VNode => h(
    'text',
    { class: name, 'dominant-baseline': 'central', 'font-size': size, 'text-anchor': anchor, x, y: tenth(y) },
    text
  )
}
