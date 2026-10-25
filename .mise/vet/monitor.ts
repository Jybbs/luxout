import { writeSync }         from 'node:fs'
import { isIP }              from 'node:net'
import { tmpdir }            from 'node:os'
import { resolve, sep }      from 'node:path'
import { fileURLToPath }     from 'node:url'
import { getSystemErrorMap } from 'node:util'

type Report = (line: string) => void

/**
 * The fields of `node:dns` a failed lookup replaces.
 */
interface Resolver {
  NOTFOUND : string
  lookup   : (...args: never[]) => unknown
  promises : { lookup: (...args: never[]) => unknown }
}

/**
 * Opens the line a preload prints for each path written outside the storage
 * directory and the system temp directory.
 */
export const OUTSIDE = 'Writes outside the storage directory:'
const WRITES         = {
  appendFile        : 0,
  copyFile          : 1,
  cp                : 1,
  createWriteStream : 0,
  mkdir             : 0,
  mkdtemp           : 0,
  rename            : 1,
  writeFile         : 0
}

/**
 * Reports each path a write reaches outside the storage directory and the
 * system temp directory, once a path.
 */
export class Writes {
  readonly #report   : Report
  readonly #reported : Set<string>
  readonly #roots    : string[]

  constructor(storage: string, report: Report = stderr) {
    this.#report   = report
    this.#reported = new Set()
    this.#roots    = [storage, tmpdir(), '/tmp'].map((root) => resolve(root))
  }

  /**
   * Wraps each call `WRITES` lists on `fs` and `fs.promises`, in its callback,
   * synchronous, and promise forms, reading the path from the argument `WRITES`
   * names for it.
   */
  watch(fs: object & { promises: object }): void {
    for (const [name, index] of Object.entries(WRITES)) {
      this.#wrap(fs, name, index)
      this.#wrap(fs, `${name}Sync`, index)
      this.#wrap(fs.promises, name, index)
    }
  }

  #check(target: unknown): void {
    const path = pathOf(target)

    if (path === undefined) return

    const kept = this.#roots.some((root) => path === root || path.startsWith(root + sep))

    if (kept || this.#reported.has(path)) return

    this.#reported.add(path)
    this.#report(`${OUTSIDE} ${path}`)
  }

  #wrap(owner: object, name: string, index: number): void {
    const method: unknown = Reflect.get(owner, name)
    const check           = (target: unknown): void => this.#check(target)

    if (typeof method !== 'function') return

    Reflect.set(owner, name, function (this: unknown, ...args: unknown[]) {
      check(args[index])

      return Reflect.apply(method, this, args)
    })
  }
}

function pathOf(target: unknown): string | undefined {
  if (target instanceof URL) return fileURLToPath(target)

  return typeof target === 'string' || Buffer.isBuffer(target) ? resolve(target.toString()) : undefined
}

function stderr(line: string): void {
  writeSync(2, `${line}\n`)
}

/**
 * Fails each host name lookup with the `ENOTFOUND` error Node raises for a host
 * no server resolves, leaving `localhost` and an IP address to resolve, so a
 * request a client sends to a named host fails before it connects, and reports
 * each host it fails.
 */
export function failLookups(resolver: Resolver, report: Report = stderr): void {
  const { lookup, promises } = resolver
  const errno                = getSystemErrorMap().entries().find(([, [name]]) => name === 'EAI_NONAME')?.[0]
  const promised             = promises.lookup

  const failure = (hostname: string): Error => {
    report(`Fails the lookup of ${hostname} as ${resolver.NOTFOUND}`)

    return Object.assign(new Error(`getaddrinfo ${resolver.NOTFOUND} ${hostname}`), {
      code     : resolver.NOTFOUND,
      errno    : errno,
      hostname : hostname,
      syscall  : 'getaddrinfo'
    })
  }
  const local = (hostname: unknown): boolean => hostname === 'localhost' || isIP(String(hostname)) > 0

  Reflect.set(resolver, 'lookup', function (this: unknown, ...args: unknown[]) {
    const callback = args.at(-1)

    if (local(args[0]) || typeof callback !== 'function') return Reflect.apply(lookup, this, args)

    queueMicrotask(() => Reflect.apply(callback, undefined, [failure(String(args[0]))]))
  })
  Reflect.set(promises, 'lookup', function (this: unknown, ...args: unknown[]) {
    return local(args[0]) ? Reflect.apply(promised, this, args) : Promise.reject(failure(String(args[0])))
  })
}
