import { Contract, ethers, providers } from 'ethers'
import { hexlify, randomBytes } from 'ethers/lib/utils'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const createCall = require('./createCall.json')

export interface DeterministicDeployment {
  address: string
  transaction: providers.TransactionRequest
}

/**
 * Creates contract deployment transactions targeting deterministic addresses using CREATE2 opcode.
 */
export class ContractDeployer {
  constructor(private provider: providers.JsonRpcProvider) {}

  /**
   * Creates a new contract deployment transactions and precomputes its deterministic creation address.
   * @param unwrappedDeploymentTx a raw deployment transaction
   * @param contractBytecode contract bytecode
   * @returns wrapped contract deployment transaction and contract deployment address
   */
  public async createDeploymentTx(
    unwrappedDeploymentTx: providers.TransactionRequest,
    contractBytecode: string
  ): Promise<DeterministicDeployment> {
    const deployerContract = await this.getDeployerContract()
    const salt = randomBytes(32)

    const transaction = await deployerContract.populateTransaction.performCreate2(0, unwrappedDeploymentTx.data, salt)
    const address = this.computeCreate2Address(deployerContract.address, hexlify(salt), contractBytecode)

    return { address, transaction }
  }

  // from: https://gist.github.com/miguelmota/c9102d370a3c1891dbd23e821be82ae2
  computeCreate2Address(creatorAddress: string, salt: string, byteCode: string): string {
    const parts = ['ff', creatorAddress.slice(2), salt.slice(2), ethers.utils.keccak256(`0x${byteCode}`).slice(2)]

    const partsHash = ethers.utils.keccak256(`0x${parts.join('')}`)
    return `0x${partsHash.slice(-40)}`.toLowerCase()
  }

  async getDeployerContract(): Promise<Contract> {
    const currentChainId = await this.provider.getNetwork()
    if (currentChainId === undefined)
      throw 'Cannot establish network in which Gnosis contract deployer contract operates'

    const address = createCall.networkAddresses[currentChainId.chainId]
    return new Contract(address, createCall.abi, this.provider)
  }
}
