import type { MarkdownRenderer } from 'vitepress'

/**
 * Names each footnote's anchors for the key its marker cites rather than for
 * its number, so `#footnote-reda2008` reaches the same note wherever the page
 * cites other works above it. A note written inline names no key and keeps its
 * number.
 */
export function anchorByKey(md: MarkdownRenderer): void {
  const numbered = md.renderer.rules.footnote_anchor_name!

  md.renderer.rules.footnote_anchor_name = (tokens, index, ...rest) => {
    const { label } = tokens[index]!.meta

    return label ? `-${md.utils.escapeHtml(label)}` : numbered(tokens, index, ...rest)
  }
}
