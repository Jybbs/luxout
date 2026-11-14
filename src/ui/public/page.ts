import type { IHomebridgePluginUi, PluginConfig } from '@homebridge/plugin-ui-utils/ui.interface'
import { type Api, type ListCollection, collection, connect, machine } from '@zag-js/listbox'
import { VanillaMachine, normalizeProps, spreadProps }                 from '@zag-js/vanilla'

import { PluginBlock }             from './block.js'
import { type Coordinates, Match } from './match.js'

type Answer = Omit<Match, 'label'>

interface Option {
  element : HTMLLIElement
  match   : Match
  value   : string
}

const MINUS = '−'  // The minus sign the page writes a negative degree with
/**
 * Matches typed coordinates, a latitude and a longitude apart by a comma, white
 * space, or both, each a signed decimal number in degrees.
 */
const TYPED = /^([+-]?\d+(?:\.\d+)?)\s*[,\s]\s*([+-]?\d+(?:\.\d+)?)$/u

/**
 * Runs the settings page, which searches for a place by the zip code or the
 * city the user types and keeps typed coordinates without a search. The
 * coordinates of each place the user confirms pass the server script's check
 * and reach the Homebridge UI in the whole block, beside the place's name,
 * region, and country, and the modal's Save writes that block to `config.json`.
 */
export class LocationPage {
  #block               : PluginBlock
  readonly #empty      : HTMLElement
  readonly #fail       : (error: unknown) => void
  readonly #homebridge : IHomebridgePluginUi
  readonly #language   : string
  readonly #latitude   : HTMLOutputElement
  readonly #listbox    : HTMLUListElement
  readonly #longitude  : HTMLOutputElement
  #options             : ListCollection<Option>
  readonly #place      : HTMLOutputElement
  readonly #query      : HTMLInputElement
  readonly #template   : HTMLLIElement
  readonly #unkept     : HTMLElement

  readonly #machine = new VanillaMachine(machine, {
    collection        : collection.empty(),
    id                : 'matches',
    ids               : { content: 'matches', label: 'matches-label' },
    onSelect          : ({ value }) => this.#choose(value),
    selectOnHighlight : true
  })

  /**
   * Shows the generated form below the page and opens the page on the blocks,
   * the platform name, and the language the Homebridge UI reports.
   */
  static async open(document: Document, homebridge: IHomebridgePluginUi): Promise<LocationPage> {
    homebridge.showSchemaForm()

    const [blocks, schema, language] = await Promise.all([
      homebridge.getPluginConfig(),
      homebridge.getPluginConfigSchema(),
      homebridge.i18nCurrentLang()
    ])

    return new LocationPage(schema.pluginAlias, blocks, document, homebridge, language)
  }

  private constructor(
    alias      : string,
    blocks     : PluginConfig[],
    document   : Document,
    homebridge : IHomebridgePluginUi,
    language   : string
  ) {
    this.#block      = PluginBlock.from(alias, blocks)
    this.#empty      = find(document, '#empty', HTMLElement)
    this.#fail       = (error) => homebridge.toast.error(message(error))
    this.#homebridge = homebridge
    this.#language   = language
    this.#latitude   = find(document, '#latitude', HTMLOutputElement)
    this.#listbox    = find(document, '#matches', HTMLUListElement)
    this.#longitude  = find(document, '#longitude', HTMLOutputElement)
    this.#options    = collection<Option>({ items: [] })
    this.#place      = find(document, '#place', HTMLOutputElement)
    this.#query      = find(document, '#query', HTMLInputElement)
    this.#template   = find(find(document, '#option', HTMLTemplateElement).content, 'li', HTMLLIElement)
    this.#unkept     = find(document, '#unkept', HTMLElement)

    find(document, '#search', HTMLFormElement).addEventListener('submit', (event) => {
      event.preventDefault()
      this.#submit().catch(this.#fail)
    })
    homebridge.addEventListener('configChanged', (event) => {
      if (event instanceof MessageEvent) this.#block = PluginBlock.from(alias, event.data)
    })

    this.#machine.subscribe(() => this.#render())
    this.#machine.start()
    this.#show()
  }

  get #api(): Api {
    return connect(this.#machine.service, normalizeProps)
  }

  /**
   * Keeps the place of the match the listbox selected as `value`.
   */
  #choose(value: string): void {
    const option = this.#options.find(value)

    if (option) this.#keep(option.match.place, option.match).catch(this.#fail)
  }

  /**
   * Sends `coordinates` through the server script's check and keeps the place
   * they round to, named by `match` where the user confirmed one.
   */
  async #keep(coordinates: Coordinates, match?: Match): Promise<void> {
    const place: Coordinates = await this.#homebridge.request('/check', coordinates)

    this.#block = this.#block.located(place, match)

    await this.#homebridge.updatePluginConfig(this.#block.blocks)

    this.#show()
  }

  /**
   * Lists `matches` as the options of the listbox, clearing the selection the
   * last search left, and shows the hint in its place where none matched.
   */
  #list(matches: Match[]): void {
    const items = matches.map((match, index) => {
      const element = this.#listbox.ownerDocument.importNode(this.#template, true)

      name(element, match)

      return { element, match, value: String(index) }
    })

    this.#options = collection({ itemToString: ({ match }) => match.label, items })

    this.#listbox.replaceChildren(...items.map(({ element }) => element))
    this.#empty.hidden   = matches.length > 0
    this.#listbox.hidden = matches.length === 0

    this.#api.clearValue()
    this.#api.clearHighlightedValue()
    this.#machine.updateProps({ collection: this.#options })
  }

  /**
   * Spreads the props the listbox machine gives onto the list and each of its
   * options, marking the selected option with the Homebridge UI's highlight.
   */
  #render(): void {
    const api = this.#api

    spreadProps(this.#listbox, api.getContentProps())

    for (const item of this.#options.items) {
      spreadProps(item.element, api.getItemProps({ item }))
      item.element.classList.toggle('list-group-item-highlight', api.getItemState({ item }).selected)
    }
  }

  async #search(query: string): Promise<void> {
    this.#homebridge.showSpinner()

    try {
      const answers: Answer[] = await this.#homebridge.request('/search', { language: this.#language, query })

      this.#list(answers.map(({ country, name, place, region }) => new Match(name, place, country, region)))
    } finally {
      this.#homebridge.hideSpinner()
    }
  }

  #show(): void {
    const { coordinates, match } = this.#block

    this.#latitude.value  = coordinates ? figure(coordinates.latitude) : ''
    this.#longitude.value = coordinates ? figure(coordinates.longitude) : ''
    this.#unkept.hidden   = coordinates !== undefined

    name(this.#place, match)
  }

  async #submit(): Promise<void> {
    const query = this.#query.value.trim()

    if (query === '') return

    const typed = TYPED.exec(query.replaceAll(MINUS, '-'))

    this.#list([])

    if (!typed) return this.#search(query)

    return this.#keep({ latitude: Number(typed[1]), longitude: Number(typed[2]) })
  }
}

function figure(degrees: number): string {
  return String(degrees).replace('-', MINUS)
}

function find<T extends Element>(root: ParentNode, selector: string, type: abstract new () => T): T {
  const node = root.querySelector(selector)

  if (node instanceof type) return node

  throw new TypeError(`The page holds no ${selector}`)
}

function message(error: unknown): string {
  return error instanceof Object && 'message' in error ? String(error.message) : String(error)
}

/**
 * Writes the name of `match` in semibold, followed by the rest of its label, or
 * empties `node` where no match is given.
 */
function name(node: Element, match?: Match): void {
  if (!match) return node.replaceChildren()

  const strong = node.ownerDocument.createElement('strong')

  strong.className   = 'fw-semibold'
  strong.textContent = match.name
  node.replaceChildren(strong, match.label.slice(match.name.length))
}
