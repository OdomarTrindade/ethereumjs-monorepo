// The example does these things:
//
// 1. Instantiates a VM and a Blockchain
// 2. Creates the accounts from ../utils/blockchain-mock-data "pre" attribute
// 3. Creates a genesis block
// 4. Puts the blocks from ../utils/blockchain-mock-data "blocks" attribute into the Blockchain
// 5. Runs the Blockchain on the VM.

import {
  Address,
  toBytes,
  setLengthLeft,
  bytesToHex,
  hexToBytes,
  createAccount,
} from '@ethereumjs/util'
import {
  Block,
  createBlockFromBlockData,
  createBlockFromRLPSerializedBlock,
} from '@ethereumjs/block'
import {
  Blockchain,
  ConsensusDict,
  createBlockchain,
  EthashConsensus,
} from '@ethereumjs/blockchain'
import { Common, ConsensusAlgorithm, ConsensusType } from '@ethereumjs/common'
import { Ethash } from '@ethereumjs/ethash'
import { runBlock, VM } from '@ethereumjs/vm'

import testData from './helpers/blockchain-mock-data.json'

async function main() {
  const common = new Common({ chain: 1, hardfork: testData.network.toLowerCase() })
  const validatePow = common.consensusType() === ConsensusType.ProofOfWork
  const validateBlocks = true

  const genesisBlock = createBlockFromBlockData({ header: testData.genesisBlockHeader }, { common })

  const consensusDict: ConsensusDict = {}
  consensusDict[ConsensusAlgorithm.Ethash] = new EthashConsensus(new Ethash())
  const blockchain = await createBlockchain({
    common,
    validateBlocks,
    validateConsensus: validatePow,
    consensusDict,
    genesisBlock,
  })

  const vm = await VM.create({ blockchain, common })

  await setupPreConditions(vm, testData)

  await putBlocks(blockchain, common, testData)

  await blockchain.iterator('vm', async (block: Block, reorg: boolean) => {
    const parentBlock = await blockchain!.getBlock(block.header.parentHash)
    const parentState = parentBlock.header.stateRoot
    // run block
    await runBlock(vm, { block, root: parentState, skipHardForkValidation: true })
  })

  const blockchainHead = await vm.blockchain.getIteratorHead!()

  console.log('--- Finished processing the Blockchain ---')
  console.log('New head:', bytesToHex(blockchainHead.hash()))
  console.log('Expected:', testData.lastblockhash)
}

async function setupPreConditions(vm: VM, data: any) {
  await vm.stateManager.checkpoint()

  for (const [addr, acct] of Object.entries(data.pre)) {
    const { nonce, balance, storage, code } = acct as any

    const address = new Address(hexToBytes(addr))
    const account = createAccount({ nonce, balance })
    await vm.stateManager.putAccount(address, account)

    for (const [key, val] of Object.entries(storage)) {
      const storageKey = setLengthLeft(hexToBytes(key), 32)
      const storageVal = hexToBytes(val as string)
      await vm.stateManager.putContractStorage(address, storageKey, storageVal)
    }

    const codeBuf = hexToBytes('0x' + code)
    await vm.stateManager.putContractCode(address, codeBuf)
  }

  await vm.stateManager.commit()
}

async function putBlocks(blockchain: Blockchain, common: Common, data: typeof testData) {
  for (const blockData of data.blocks) {
    const blockRlp = toBytes(blockData.rlp)
    const block = createBlockFromRLPSerializedBlock(blockRlp, { common })
    await blockchain.putBlock(block)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
