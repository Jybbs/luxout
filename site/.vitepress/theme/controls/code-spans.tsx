import type { VNode } from 'vue'

/**
 * Sets each span of `text` written between backticks as code, leaving the
 * words around it as text.
 */
export function codeSpans(text: string): (VNode | string)[] {
  return text.split('`').map((piece, index) => index % 2 ? <code>{piece}</code> : piece)
}
