import type { MarkdownRenderer } from 'vitepress'

import type { Placement } from './placements.ts'

type Rule         = Parameters<MarkdownRenderer['core']['ruler']['push']>[1]
type State        = Parameters<Rule>[0]
type Token        = State['tokens'][number]
type TokenFactory = (content: string) => Token

function frameAt(tokens: readonly Token[], frame: string): number {
  return tokens.findIndex((token, index) =>
    token.type === 'paragraph_open'
    && tokens[index + 1]?.children?.some((child) => child.type === 'image' && child.attrGet('src') === frame)
  )
}

function placed(tokens: readonly Token[], placement: Placement, html: TokenFactory): Token[] {
  const { fold, frame, heading, page, widget, words } = placement

  const fail  = (what: string) => new Error(`${page} holds no ${what} under the heading "${heading}"`)
  const start = tokens.findIndex((token, index) =>
    token.type === 'heading_open' && tokens[index + 1]?.content === heading
  )

  if (start < 0) throw new Error(`${page} holds no heading "${heading}"`)

  const level = tokens[start]!.tag
  const body  = start + 3
  const open  = tokens.findIndex((token, index) =>
    index >= body && (token.type === 'table_open' || token.type === 'heading_open' && token.tag <= level)
  )

  if (tokens[open]?.type !== 'table_open') throw fail('table')

  const close   = tokens.findIndex((token, index) => index > open && token.type === 'table_close')
  const between = tokens.slice(body, open)
  const image   = frame ? frameAt(between, frame) : undefined

  if (image === -1) throw fail(`frame ${frame}`)

  const before = image === undefined ? between : between.toSpliced(image, 3)

  return [
    ...tokens.slice(0, body),
    ...words ? [html(`<${widget}>`), ...before, html(`</${widget}>`)] : [...before, html(`<${widget} />`)],
    html(`<TableFold summary="${fold}">`),
    ...tokens.slice(open, close + 1),
    html('</TableFold>'),
    ...tokens.slice(close + 1)
  ]
}

/**
 * Sets each placement's widget into its section of the page it names, as the
 * page renders on the site. The Markdown keeps its table and its frame for
 * GitHub, the table folds shut beneath the widget, and a heading, a table, or a
 * frame the placement cannot find fails the build.
 */
export function placeWidgets(md: MarkdownRenderer, placements: readonly Placement[]): void {
  md.core.ruler.push('place_widgets', (state) => {
    const { env, Token: Html } = state
    const html: TokenFactory   = (content) => Object.assign(new Html('html_block', '', 0), { content })

    for (const placement of placements.filter(({ page }) => page === env.relativePath)) {
      state.tokens = placed(state.tokens, placement, html)
    }
  })
}
