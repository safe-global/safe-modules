import {
  Address,
  Chain,
  Hex,
  PrivateKeyAccount,
  PublicClient,
  Transport,
  encodeFunctionData,
  encodePacked,
  formatEther,
  getContractAddress,
  hexToBigInt,
  keccak256,
  parseEther,
  zeroAddress,
} from 'viem'
import { InternalTx, encodeMultiSend } from './multisend'
import { generateApproveCallData, generateTransferCallData, getERC20Balance, getERC20Decimals, mintERC20Token } from './erc20'
import { setTimeout } from 'timers/promises'
import { generateMintingCallData } from './erc721'
import { transferETH } from './nativeTransfer'
import {
  SAFE_4337_EXECUTE_USEROP_ABI,
  SAFE_ENABLE_MODULES_ABI,
  SAFE_EXECTRANSACTION_ABI,
  SAFE_FACTORY_CREATE_PROXY_WITH_NONCE_ABI,
  SAFE_FACTORY_PROXY_CREATION_CODE_ABI,
  SAFE_NONCE_ABI,
  SAFE_SETUP_ABI,
} from './abi'
import { EIP712_SAFE_TX_TYPE } from './type'

export interface MetaTransaction {
  to: Address
  value: bigint
  data: `0x${string}`
  operation: number
  nonce: bigint
}

export const getGelatoCallData = async <C extends Chain>({
  safe,
  owner,
  publicClient,
  txType,
  erc20TokenAddress,
  erc721TokenAddress,
}: {
  safe: Address
  owner: PrivateKeyAccount
  publicClient: PublicClient<Transport<'http'>, C>
  txType: string
  erc20TokenAddress: Address
  erc721TokenAddress: Address
}) => {
  let setupTxs: MetaTransaction

  const nonce = (await publicClient.readContract({
    abi: SAFE_NONCE_ABI,
    address: safe,
    functionName: 'nonce',
  })) as bigint

  if (txType == 'erc20') {
    // Token Configurations
    const erc20Decimals = BigInt(await getERC20Decimals(erc20TokenAddress, publicClient))
    const erc20Amount = 10n ** erc20Decimals

    setupTxs = {
      to: erc20TokenAddress,
      value: 0n,
      data: generateTransferCallData(owner.address, erc20Amount), // transfer() function call with corresponding data.
      operation: 0, // 0 = Call
      nonce: nonce,
    }
  } else if (txType == 'erc721') {
    setupTxs = {
      to: erc721TokenAddress,
      data: generateMintingCallData(owner.address), // safeMint() function call with corresponding data.
      value: 0n,
      operation: 0,
      nonce: nonce,
    }
  } else if (txType == 'native-transfer') {
    const weiToSend = parseEther('0.000001')

    setupTxs = {
      to: owner.address,
      data: '0x', // No data required for native transfer.
      value: weiToSend,
      operation: 0,
      nonce: nonce,
    }
  } else {
    throw new Error('Invalid transaction type.')
  }
  console.log('\nAppropriate calldata created.')

  const signature = [
    {
      signer: owner.address,
      data: await owner.signTypedData({
        domain: {
          chainId: await publicClient.getChainId(),
          verifyingContract: safe,
        },
        types: EIP712_SAFE_TX_TYPE,
        primaryType: 'SafeTx',
        message: {
          to: setupTxs.to,
          data: setupTxs.data,
          value: setupTxs.value,
          operation: setupTxs.operation,
          safeTxGas: 0n,
          baseGas: 0n,
          gasPrice: 0n,
          gasToken: zeroAddress,
          refundReceiver: zeroAddress,
          nonce: setupTxs.nonce,
        },
      }),
    },
  ]

  console.log('\nSignature for Call Data created.')

  const callData = encodeFunctionData({
    abi: SAFE_EXECTRANSACTION_ABI,
    functionName: 'execTransaction',
    args: [setupTxs.to, setupTxs.value, setupTxs.data, setupTxs.operation, 0n, 0n, 0n, zeroAddress, zeroAddress, signature[0].data],
  })

  return callData
}

const getInitializerCode = async ({
  owner,
  safeModuleSetupAddress,
  safe4337ModuleAddress,
  multiSendAddress,
  erc20TokenAddress,
  paymasterAddress,
}: {
  owner: Address
  safeModuleSetupAddress: Address
  safe4337ModuleAddress: Address
  multiSendAddress: Address
  erc20TokenAddress: Address
  paymasterAddress: Address
}) => {
  const setupTxs: InternalTx[] = [
    {
      to: safeModuleSetupAddress,
      data: enableModuleCallData(safe4337ModuleAddress),
      value: 0n,
      operation: 1, // 1 = DelegateCall required for enabling the module
    },
  ]

  if (erc20TokenAddress != zeroAddress && paymasterAddress != zeroAddress) {
    setupTxs.push({
      to: erc20TokenAddress,
      data: generateApproveCallData(paymasterAddress),
      value: 0n,
      operation: 0, // 0 = Call
    })
  }

  const recipient = setupTxs.length > 1 ? multiSendAddress : safeModuleSetupAddress
  const calldata = setupTxs.length > 1 ? encodeMultiSend(setupTxs) : setupTxs[0].data

  return encodeFunctionData({
    abi: SAFE_SETUP_ABI,
    functionName: 'setup',
    args: [[owner], 1n, recipient, calldata, safe4337ModuleAddress, zeroAddress, 0n, zeroAddress],
  })
}

const getGelatoInitializerCode = async <C extends Chain>({
  owner,
  client,
  txType,
  safeModuleSetupAddress,
  safe4337ModuleAddress,
  multiSendAddress,
  erc20TokenAddress,
  erc721TokenAddress,
}: {
  owner: Address
  client: PublicClient<Transport<'http'>, C>
  txType: string
  safeModuleSetupAddress: Address
  safe4337ModuleAddress: Address
  multiSendAddress: Address
  erc20TokenAddress: Address
  erc721TokenAddress: Address
}) => {
  const setupTxs: InternalTx[] = [
    {
      to: safeModuleSetupAddress,
      data: enableModuleCallData(safe4337ModuleAddress),
      value: 0n,
      operation: 1, // 1 = DelegateCall required for enabling the module
    },
  ]
  if (txType == 'erc20') {
    // Token Configurations
    const erc20Decimals = BigInt(await getERC20Decimals(erc20TokenAddress, client))
    const erc20Amount = 10n ** erc20Decimals

    setupTxs.push({
      to: erc20TokenAddress,
      data: generateTransferCallData(owner, erc20Amount), // transfer() function call with corresponding data.
      value: 0n,
      operation: 0, // 0 = Call
    })
  } else if (txType == 'erc721') {
    setupTxs.push({
      to: erc721TokenAddress,
      data: generateMintingCallData(owner), // safeMint() function call with corresponding data.
      value: 0n,
      operation: 0, // 0 = Call
    })
  } else if (txType == 'native-transfer') {
    const weiToSend = parseEther('0.000001')

    setupTxs.push({
      to: owner,
      data: '0x', // No data required for native transfer.
      value: weiToSend,
      operation: 0, // 0 = Call
    })
  }
  console.log('\nAppropriate calldata created.')

  const multiSendCallData = encodeMultiSend(setupTxs)

  return encodeFunctionData({
    abi: SAFE_SETUP_ABI,
    functionName: 'setup',
    args: [[owner], 1n, multiSendAddress, multiSendCallData, safe4337ModuleAddress, zeroAddress, 0n, zeroAddress],
  })
}

export const prepareForGelatoTx = async <C extends Chain>({
  signer,
  chain,
  publicClient,
  txType,
  senderAddress,
  erc20TokenAddress,
}: {
  signer: PrivateKeyAccount
  chain: string
  publicClient: PublicClient<Transport<'http'>, C>
  txType: string
  senderAddress: Address
  erc20TokenAddress: Address
}) => {
  if (txType == 'erc20') {
    // Token Configurations
    const erc20Decimals = BigInt(await getERC20Decimals(erc20TokenAddress, publicClient))
    const erc20Amount = 10n ** erc20Decimals
    let senderERC20Balance = await getERC20Balance(erc20TokenAddress, publicClient, senderAddress)
    console.log('\nSafe Wallet ERC20 Balance:', Number(senderERC20Balance / erc20Amount))

    // Trying to mint tokens (Make sure ERC20 Token Contract is mintable by anyone).
    if (senderERC20Balance < erc20Amount) {
      console.log('\nMinting ERC20 Tokens to Safe Wallet.')
      await mintERC20Token(erc20TokenAddress, publicClient, signer, senderAddress, erc20Amount, 'gelato')

      while (senderERC20Balance < erc20Amount) {
        await setTimeout(15000)
        senderERC20Balance = await getERC20Balance(erc20TokenAddress, publicClient, senderAddress)
      }
      console.log('\nUpdated Safe Wallet ERC20 Balance:', Number(senderERC20Balance / erc20Amount))
    }
  } else if (txType == 'native-transfer') {
    const weiToSend = parseEther('0.000001')
    let safeETHBalance = await publicClient.getBalance({
      address: senderAddress,
    })
    if (safeETHBalance < weiToSend) {
      console.log('\nTransferring', formatEther(weiToSend - safeETHBalance), 'ETH to Safe for native transfer.')
      await transferETH(publicClient, signer, senderAddress, weiToSend - safeETHBalance, chain, 'gelato')
      while (safeETHBalance < weiToSend) {
        await setTimeout(30000) // Sometimes it takes time to index.
        safeETHBalance = await publicClient.getBalance({
          address: senderAddress,
        })
      }
      console.log('\nTransferred required ETH for the native transfer.')
    }
  }
  console.log('\nAppropriate preparation done for transaction.')
}

export const enableModuleCallData = (safe4337ModuleAddress: `0x${string}`) => {
  return encodeFunctionData({
    abi: SAFE_ENABLE_MODULES_ABI,
    functionName: 'enableModules',
    args: [[safe4337ModuleAddress]],
  })
}

export const getAccountInitCode = async ({
  owner,
  safeModuleSetupAddress,
  safe4337ModuleAddress,
  safeSingletonAddress,
  saltNonce = 0n,
  multiSendAddress,
  erc20TokenAddress,
  paymasterAddress,
}: {
  owner: Address
  safeModuleSetupAddress: Address
  safe4337ModuleAddress: Address
  safeSingletonAddress: Address
  saltNonce?: bigint
  multiSendAddress: Address
  erc20TokenAddress: Address
  paymasterAddress: Address
}): Promise<Hex> => {
  if (!owner) throw new Error('Owner account not found')
  const initializer = await getInitializerCode({
    owner,
    safeModuleSetupAddress,
    safe4337ModuleAddress,
    multiSendAddress,
    erc20TokenAddress,
    paymasterAddress,
  })

  const initCodeCallData = encodeFunctionData({
    abi: SAFE_FACTORY_CREATE_PROXY_WITH_NONCE_ABI,
    functionName: 'createProxyWithNonce',
    args: [safeSingletonAddress, initializer, saltNonce],
  })

  return initCodeCallData
}

export const getGelatoAccountInitCode = async <C extends Chain>({
  owner,
  client,
  txType,
  safeModuleSetupAddress,
  safe4337ModuleAddress,
  safeSingletonAddress,
  saltNonce = 0n,
  multiSendAddress,
  erc20TokenAddress,
  erc721TokenAddress,
}: {
  owner: Address
  client: PublicClient<Transport<'http'>, C>
  txType: string
  safeModuleSetupAddress: Address
  safe4337ModuleAddress: Address
  safeSingletonAddress: Address
  saltNonce?: bigint
  multiSendAddress: Address
  erc20TokenAddress: Address
  erc721TokenAddress: Address
}): Promise<Hex> => {
  if (!owner) throw new Error('Owner account not found')
  const initializer = await getGelatoInitializerCode({
    owner,
    client,
    txType,
    safeModuleSetupAddress,
    safe4337ModuleAddress,
    multiSendAddress,
    erc20TokenAddress,
    erc721TokenAddress,
  })

  const initCodeCallData = encodeFunctionData({
    abi: SAFE_FACTORY_CREATE_PROXY_WITH_NONCE_ABI,
    functionName: 'createProxyWithNonce',
    args: [safeSingletonAddress, initializer, saltNonce],
  })

  return initCodeCallData
}

export const encodeCallData = (params: { to: Address; value: bigint; data: `0x${string}` }) => {
  return encodeFunctionData({
    abi: SAFE_4337_EXECUTE_USEROP_ABI,
    functionName: 'executeUserOp',
    args: [params.to, params.value, params.data, 0],
  })
}

export const getAccountAddress = async <C extends Chain>({
  owner,
  client,
  txType = '',
  safeModuleSetupAddress,
  safe4337ModuleAddress,
  safeProxyFactoryAddress,
  safeSingletonAddress,
  saltNonce = 0n,
  multiSendAddress,
  erc20TokenAddress,
  erc721TokenAddress = zeroAddress,
  paymasterAddress,
  isGelato = false,
}: {
  owner: Address
  client: PublicClient<Transport<'http'>, C>
  txType?: string
  safeModuleSetupAddress: Address
  safe4337ModuleAddress: Address
  safeProxyFactoryAddress: Address
  safeSingletonAddress: Address
  saltNonce?: bigint
  multiSendAddress: Address
  erc20TokenAddress: Address
  erc721TokenAddress?: Address
  paymasterAddress: Address
  isGelato?: boolean
}): Promise<Address> => {
  const proxyCreationCode = (await client.readContract({
    abi: SAFE_FACTORY_PROXY_CREATION_CODE_ABI,
    address: safeProxyFactoryAddress,
    functionName: 'proxyCreationCode',
  })) as `0x${string}`

  const deploymentCode = encodePacked(['bytes', 'uint256'], [proxyCreationCode, hexToBigInt(safeSingletonAddress)])

  let initializer
  if (isGelato) {
    initializer = await getGelatoInitializerCode({
      owner,
      client,
      txType,
      safeModuleSetupAddress,
      safe4337ModuleAddress,
      multiSendAddress,
      erc20TokenAddress,
      erc721TokenAddress,
    })
  } else {
    initializer = await getInitializerCode({
      owner,
      safeModuleSetupAddress,
      safe4337ModuleAddress,
      multiSendAddress,
      erc20TokenAddress,
      paymasterAddress,
    })
  }

  const salt = keccak256(encodePacked(['bytes32', 'uint256'], [keccak256(encodePacked(['bytes'], [initializer])), saltNonce]))

  return getContractAddress({
    from: safeProxyFactoryAddress,
    salt,
    bytecode: deploymentCode,
    opcode: 'CREATE2',
  })
}
