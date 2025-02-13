import { Chain, Common } from '@ethereumjs/common'
import { bytesToHex, hexToBytes } from '@ethereumjs/util'
import { assert, beforeAll, describe, it } from 'vitest'

import { createEVM, getActivePrecompiles } from '../../src/index.js'

import fuzzer from './modexp-testdata.json'

import type { EVM } from '../../src/index.js'
import type { PrecompileFunc } from '../../src/precompiles/types.js'
import type { PrefixedHexString } from '@ethereumjs/util'

const fuzzerTests = fuzzer.data as PrefixedHexString[][]
describe('Precompiles: MODEXP', () => {
  let common: Common
  let evm: EVM
  let addressStr: string
  let MODEXP: PrecompileFunc
  beforeAll(async () => {
    common = new Common({ chain: Chain.Mainnet })
    evm = await createEVM({
      common,
    })
    addressStr = '0000000000000000000000000000000000000005'
    MODEXP = getActivePrecompiles(common).get(addressStr)!
  })

  let n = 0
  for (const [input, expect] of fuzzerTests) {
    n++
    it(`MODEXP edge cases (issue 3168) - case ${n}`, async () => {
      const result = await MODEXP({
        data: hexToBytes(input),
        gasLimit: BigInt(0xffff),
        common,
        _EVM: evm,
      })
      const oput = bytesToHex(result.returnValue)
      assert.equal(oput, expect)
    })
  }

  it('should correctly right-pad data if input length is too short', async () => {
    const gas = BigInt(0xffff)
    const result = await MODEXP({
      data: hexToBytes('0x41'),
      gasLimit: gas,
      common,
      _EVM: evm,
    })
    assert.ok(result.executionGasUsed === gas)
  })
})
