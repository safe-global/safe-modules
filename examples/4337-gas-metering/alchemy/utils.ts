import { Alchemy } from 'alchemy-sdk'
import { fromHex } from 'viem'
import { UserOperation } from '../utils/userOps'

// Sponsored User Operation Data
export type suoData = {
  preVerificationGas: string
  callGasLimit: string
  verificationGasLimit: string
  paymasterAndData: string
  maxFeePerGas: string
  maxPriorityFeePerGas: string
}

export type gasData = {
  preVerificationGas: string
  callGasLimit: string
  verificationGasLimit: string
}

export const serializeValuesToBigInt = (obj: Record<string, string>): Record<string, bigint> => {
  return Object.entries(obj).reduce(
    (acc, [key, value]) => {
      acc[key] = BigInt(value)
      return acc
    },
    {} as Record<string, bigint>,
  )
}

export const addHexPrefix = (hexStr: string) => (hexStr.startsWith('0x') ? hexStr : `0x${hexStr}`)

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
            nonce: '0x' + sponsoredUserOperation.nonce.toString(16),
            initCode: sponsoredUserOperation.initCode,
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

  return serializeValuesToBigInt(suoData)
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

  console.log({ responseValues })
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
          maxFeePerGas: sponsoredUserOperation.maxFeePerGas.toString(16),
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
  console.log(responseValues)
  let rvGas
  if (responseValues && responseValues['result']) {
    rvGas = responseValues['result'] as gasData
  } else {
    throw new Error('No gas data found')
  }

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
          maxFeePerGas: sponsoredUserOperation.maxFeePerGas.toString(16),
          maxPriorityFeePerGas: addHexPrefix(sponsoredUserOperation.maxPriorityFeePerGas.toString(16)),
          nonce: addHexPrefix(sponsoredUserOperation.nonce.toString(16)),
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
      await new Promise((resolve) => setTimeout(resolve, 25000))
      await fetch('https://eth-' + chain + '.g.alchemy.com/v2/' + apiKey, hashOptions)
        .then((response) => response.json())
        .then((json) => {
          if (json.error && 'message' in json.error) {
            throw new Error(json.error.message)
          }
          receipt = json
        })
      runOnce = false
    }

    if (receipt['result'] && receipt['result']['receipt']['transactionHash']) {
      console.log('\nTransaction Link: https://' + chain + '.etherscan.io/tx/' + receipt['result']['receipt']['transactionHash'])
      const actualGasUsed = fromHex(receipt['result']['actualGasUsed'], 'number')
      const gasUsed = fromHex(responseValues['result']['receipt']['gasUsed'], 'number')
      console.log(`\nGas Used (Account or Paymaster): ${actualGasUsed}`)
      console.log(`Gas Used (Transaction): ${gasUsed}\n`)
    }
  }
}
