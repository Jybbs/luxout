import { type VNode, h } from 'vue'

import './styles/layers.css'

/**
 * Stacks `children` in one grid cell, showing the one at `selected` and marking
 * the rest `inert`, so a widget keeps the height of its tallest layer.
 */
export function layers(children: readonly VNode[], selected: number): VNode {
  return h('div', { class: 'layers' }, children.map((child, index) => {
    const shown = index === selected

    return h('div', { class: ['layer', { shown }], inert: !shown }, child)
  }))
}
