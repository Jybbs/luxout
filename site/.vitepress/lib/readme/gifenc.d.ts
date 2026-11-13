declare module 'gifenc' {
  /**
   * A color as its red, green, and blue channels from 0 to 255.
   */
  export type Color = readonly [red: number, green: number, blue: number]

  /**
   * A GIF stream frames are written into.
   */
  export interface Encoder {
    bytes(): Uint8Array
    finish(): void
    writeFrame(index: Uint8Array, width: number, height: number, options?: FrameOptions): void
  }

  /**
   * How one frame is written, `delay` in milliseconds.
   */
  export interface FrameOptions {
    delay?            : number
    dispose?          : number
    palette?          : readonly Color[]
    repeat?           : number
    transparent?      : boolean
    transparentIndex? : number
  }

  export function GIFEncoder(): Encoder
  export function applyPalette(rgba: Uint8Array, palette: readonly Color[]): Uint8Array
  export function quantize(
    rgba      : Uint8Array,
    maxColors : number,
    options?  : { format?: 'rgb444' | 'rgb565' }
  ): Color[]
}
