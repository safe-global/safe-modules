import { Alchemy } from 'alchemy-sdk'
import { fromHex } from 'viem'
import { setTimeout } from 'timers/promises'
import { UserOperation } from '../utils/userOps'

// Sponsored User Operation Data
export type suoData = {
  preVerificationGas: string
  callGasLimit: string
  verificationGasLimit: string
  paymaster: string
  paymasterData: string
  paymasterVerificationGasLimit: string
  paymasterPostOpGasLimit: string
  maxFeePerGas: string
  maxPriorityFeePerGas: string
}

export type gasData = {
  preVerificationGas: string
  callGasLimit: string
  verificationGasLimit: string
  paymasterVerificationGasLimit: string | null
}

export const serializeValuesToBigInt = <T extends Record<string, string>, K extends keyof T = never>(
  obj: T,
  excludeFields: K[] = [] as K[],
): {
  [P in keyof T]: P extends K ? T[P] : bigint
} => {
  return Object.entries(obj).reduce(
    (acc, [key, value]) => {
      if (excludeFields.includes(key as K)) {
        acc[key as keyof T] = value as keyof T extends K ? T[K & keyof T] : bigint
      } else {
        acc[key as keyof T] = BigInt(value) as keyof T extends K ? T[K & keyof T] : bigint
      }
      return acc
    },
    {} as {
      [P in keyof T]: P extends K ? T[P] : bigint
    },
  )
}

export const addHexPrefix = (hexStr: string): `0x${string}` => (hexStr.startsWith('0x') ? (hexStr as `0x{string}`) : `0x${hexStr}`)

export const getGasValuesFromAlchemyPaymaster = async (
  policyID: string | undefined,
  entryPointAddress: `0x${string}`,
  sponsoredUserOperation: UserOperation,
  chain: string,
  apiKey: string,
) => {
  const gasOptions = {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'alchemy_requestGasAndPaymasterAndData',
      params: [
        {
          policyId: policyID,
          entryPoint: entryPointAddress,
          dummySignature: sponsoredUserOperation.signature,
          userOperation: {
            sender: sponsoredUserOperation.sender,
            nonce: addHexPrefix(sponsoredUserOperation.nonce.toString(16)),
            factory: sponsoredUserOperation.factory,
            factoryData: sponsoredUserOperation.factoryData,
            callData: sponsoredUserOperation.callData,
          },
        },
      ],
    }),
  }

  const suoData = await fetch('https://eth-' + chain + '.g.alchemy.com/v2/' + apiKey, gasOptions)
    .then((response) => response.json())
    .then((response) => {
      if (response.error && 'message' in response.error) {
        throw new Error(response.error.message)
      }

      if (!response.result) {
        throw new Error('No paymaster data found')
      }

      return response.result as suoData
    })
  console.log('\nReceived Paymaster Data from Alchemy.')

  return serializeValuesToBigInt(suoData, ['paymaster', 'paymasterData'])
}

export const getMaxPriorityFeePerGasFromAlchemy = async (chain: string, apiKey: string): Promise<bigint> => {
  const feeOptions = {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'rundler_maxPriorityFeePerGas',
    }),
  }

  const responseValues = await fetch('https://eth-' + chain + '.g.alchemy.com/v2/' + apiKey, feeOptions)
    .then((response) => response.json())
    .then((json) => {
      if (json.error && 'message' in json.error) {
        throw new Error(json.error.message)
      }
      return json
    })
  console.log('\nReceived Fee Data from Alchemy.')

  let rvFee
  if (responseValues && responseValues['result']) {
    rvFee = responseValues['result']
  }
  return BigInt(rvFee)
}

export const getMaxFeePerGas = async (alchemy: Alchemy, maxPriorityFeePerGas: bigint): Promise<bigint> => {
  let maxFeePerGas

  // Get the latest Block Number
  const latestBlockNum = await alchemy.core.getBlockNumber()

  // Get latest Block Details
  const rvBlock = await alchemy.core.getBlock(latestBlockNum)
  if (rvBlock && rvBlock.baseFeePerGas) {
    maxFeePerGas = ((BigInt(rvBlock.baseFeePerGas._hex) + BigInt(maxPriorityFeePerGas)) * 15n) / 10n // Adding a buffer. Recommended is atleast 50%.
    // https://docs.alchemy.com/reference/bundler-api-fee-logic
  }

  if (!maxFeePerGas) {
    throw new Error('No maxFeePerGas found')
  }

  return maxFeePerGas
}

export const getGasValuesFromAlchemy = async (
  entryPointAddress: `0x${string}`,
  sponsoredUserOperation: UserOperation,
  chain: string,
  apiKey: string,
) => {
  const gasOptions = {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_estimateUserOperationGas',
      params: [
        {
          ...sponsoredUserOperation,
          // According to the ERC-4337, gas values are used for estimation if you pass them. We want to estimate gas values, so we pass undefined.
          callGasLimit: undefined,
          verificationGasLimit: undefined,
          preVerificationGas: undefined,
          maxFeePerGas: addHexPrefix(sponsoredUserOperation.maxFeePerGas.toString(16)),
          maxPriorityFeePerGas: addHexPrefix(sponsoredUserOperation.maxPriorityFeePerGas.toString(16)),
          nonce: addHexPrefix(sponsoredUserOperation.nonce.toString(16)),
        },
        entryPointAddress,
      ],
    }),
  }

  const responseValues = await fetch('https://eth-' + chain + '.g.alchemy.com/v2/' + apiKey, gasOptions)
    .then((response) => response.json())
    .then((json) => {
      if (json.error && 'message' in json.error) {
        throw new Error(json.error.message)
      }
      return json
    })

  console.log('\nReceived Gas Data from Alchemy.')
  let rvGas: gasData | undefined
  if (responseValues && responseValues['result']) {
    rvGas = responseValues['result'] as gasData
  } else {
    throw new Error('No gas data found')
  }

  if (!rvGas.paymasterVerificationGasLimit) {
    rvGas.paymasterVerificationGasLimit = '0x0'
  }
  // @ts-expect-error I don't know why but the types are not correct
  return serializeValuesToBigInt(rvGas)
}

export const submitUserOperationAlchemy = async (
  entryPointAddress: `0x${string}`,
  sponsoredUserOperation: UserOperation,
  chain: string,
  apiKey: string,
) => {
  const options = {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_sendUserOperation',
      params: [
        {
          ...sponsoredUserOperation,
          callGasLimit: addHexPrefix(sponsoredUserOperation.callGasLimit.toString(16)),
          verificationGasLimit: addHexPrefix(sponsoredUserOperation.verificationGasLimit.toString(16)),
          preVerificationGas: addHexPrefix(sponsoredUserOperation.preVerificationGas.toString(16)),
          maxFeePerGas: addHexPrefix(sponsoredUserOperation.maxFeePerGas.toString(16)),
          maxPriorityFeePerGas: addHexPrefix(sponsoredUserOperation.maxPriorityFeePerGas.toString(16)),
          nonce: addHexPrefix(sponsoredUserOperation.nonce.toString(16)),
          // Paymaster fields do not pass alchemy validation if the transaction doesn't have a paymaster.
          ...(sponsoredUserOperation.paymaster
            ? {
                paymasterPostOpGasLimit: addHexPrefix(sponsoredUserOperation.paymasterPostOpGasLimit?.toString(16) ?? '0x'),
                paymasterVerificationGasLimit: addHexPrefix(sponsoredUserOperation.paymasterVerificationGasLimit?.toString(16) ?? '0x'),
              }
            : {}),
        },
        entryPointAddress,
      ],
    }),
  }

  const responseValues = await fetch('https://eth-' + chain + '.g.alchemy.com/v2/' + apiKey, options)
    .then((response) => response.json())
    .then((json) => {
      if (json.error && 'message' in json.error) {
        throw new Error(json.error.message)
      }
      return json
    })

  if (responseValues && responseValues['result']) {
    console.log('UserOperation submitted. Hash:', responseValues['result'])
    console.log('UserOp Link: https://jiffyscan.xyz/userOpHash/' + responseValues['result'] + '?network=' + chain)

    const hashOptions = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_getUserOperationReceipt',
        params: [responseValues['result']],
        entryPoint: entryPointAddress,
      }),
    }
    let runOnce = true

    let receipt
    while (receipt == null || runOnce) {
      await setTimeout(25000)
      await fetch('https://eth-' + chain + '.g.alchemy.com/v2/' + apiKey, hashOptions)
        .then((response) => response.json())
        .then((json) => {
          if (json.error && 'message' in json.error) {
            throw new Error(json.error.message)
          }
          receipt = json['result']
        })
      runOnce = false
    }

    if (receipt && receipt['receipt']['transactionHash']) {
      console.log('\nTransaction Link: https://' + chain + '.etherscan.io/tx/' + receipt['receipt']['transactionHash'])
      const actualGasUsed = fromHex(receipt['actualGasUsed'], 'number')
      const gasUsed = fromHex(receipt['receipt']['gasUsed'], 'number')
      console.log(`\nGas Used (Account or Paymaster): ${actualGasUsed}`)
      console.log(`Gas Used (Transaction): ${gasUsed}\n`)
    }
  }
}
