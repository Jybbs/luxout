import { Characteristic } from '@homebridge/hap-nodejs'
import { expect, it }     from 'vitest'

import { Chunk } from '../../../lib/bundle/chunk.ts'

const STUB = 'a.js: carries the empty module Vite builds in place of a Node built-in'

it.each([
  { code: 'export const a=1;', name: 'plain code' },
  { code: 'var a=X(((e,t)=>{t.exports={a:1}}));', name: 'a module exporting a value' },
  { code: 'var a=X(((e,t)=>{e.exports={}}));', name: 'an empty object set on the first parameter' },
  { code: 'var a=X(((e,t)=>{t.hot={}}));', name: 'an empty object set on another property' },
  { code: 'var a=X(((e,t)=>{t.exports={};t.b=1}));', name: 'a wrapper running more than the assignment' },
  { code: 'var a=X(((e,t)=>t.exports={}));', name: 'an assignment written as the arrow’s value' },
  { code: 'var a=X((t=>{t.exports={}}));', name: 'a wrapper taking one parameter' },
  { code: 'var a=X(((e,{t})=>{t.exports={}}));', name: 'a wrapper destructuring its second parameter' }
])('reports nothing in $name', ({ code }) => {
  expect(new Chunk(code, 'a.js').defects).toEqual([])
})

it('reports the stub Rolldown writes for a module the browser build replaces', () => {
  expect(new Chunk('var $=X(((e,t)=>{t.exports={}})),Y=1;', 'a.js').defects).toEqual([STUB])
})

it('reports HAP-NodeJS code by the UUID of a characteristic it defines', () => {
  const code = `var a={UUID:"${Characteristic.CurrentAmbientLightLevel.UUID}"},b=X(((e,t)=>{t.exports={}}));`

  expect(new Chunk(code, 'a.js').defects).toEqual(['a.js: carries HAP-NodeJS code', STUB])
})
