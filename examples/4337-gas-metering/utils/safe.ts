import {
  Address,
  Hex,
  PrivateKeyAccount,
  PublicClient,
  concatHex,
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

export const SAFE_ADDRESSES_MAP = {
  '1.4.1': {
    '5': {
      ADD_MODULES_LIB_ADDRESS: '0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb',
      SAFE_4337_MODULE_ADDRESS: '0xa581c4A4DB7175302464fF3C06380BC3270b4037',
      SAFE_PROXY_FACTORY_ADDRESS: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
      SAFE_SINGLETON_ADDRESS: '0x41675C099F32341bf84BFc5382aF534df5C7461a',
    },
    '80001': {
      ADD_MODULES_LIB_ADDRESS: '0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb',
      SAFE_4337_MODULE_ADDRESS: '0xa581c4A4DB7175302464fF3C06380BC3270b4037',
      SAFE_PROXY_FACTORY_ADDRESS: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
      SAFE_SINGLETON_ADDRESS: '0x41675C099F32341bf84BFc5382aF534df5C7461a',
    },
    '84532': {
      ADD_MODULES_LIB_ADDRESS: '0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb',
      SAFE_4337_MODULE_ADDRESS: '0xa581c4A4DB7175302464fF3C06380BC3270b4037',
      SAFE_PROXY_FACTORY_ADDRESS: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
      SAFE_SINGLETON_ADDRESS: '0x41675C099F32341bf84BFc5382aF534df5C7461a',
    },
    '11155111': {
      ADD_MODULES_LIB_ADDRESS: '0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb',
      SAFE_4337_MODULE_ADDRESS: '0xa581c4A4DB7175302464fF3C06380BC3270b4037',
      SAFE_PROXY_FACTORY_ADDRESS: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
      SAFE_SINGLETON_ADDRESS: '0x41675C099F32341bf84BFc5382aF534df5C7461a',
    },
  },
} as const

export const EIP712_SAFE_TX_TYPE = {
  // "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"
  SafeTx: [
    { type: 'address', name: 'to' },
    { type: 'uint256', name: 'value' },
    { type: 'bytes', name: 'data' },
    { type: 'uint8', name: 'operation' },
    { type: 'uint256', name: 'safeTxGas' },
    { type: 'uint256', name: 'baseGas' },
    { type: 'uint256', name: 'gasPrice' },
    { type: 'address', name: 'gasToken' },
    { type: 'address', name: 'refundReceiver' },
    { type: 'uint256', name: 'nonce' },
  ],
}

export interface MetaTransaction {
  to: `0x${string}`
  value: bigint
  data: `0x${string}`
  operation: number
  nonce: bigint
}

export const getGelatoCallData = async ({
  safe,
  owner,
  publicClient,
  txType,
  erc20TokenAddress,
  erc721TokenAddress,
}: {
  safe: Address
  owner: PrivateKeyAccount
  publicClient: any
  txType: string
  erc20TokenAddress: Address
  erc721TokenAddress: Address
}) => {
  let setupTxs: MetaTransaction

  const nonce = await publicClient.readContract({
    abi: [
      {
        inputs: [],
        name: 'nonce',
        outputs: [{ type: 'uint256' }],
        type: 'function',
        stateMutability: 'view',
      },
    ],
    address: safe,
    functionName: 'nonce',
  })

  if (txType == 'erc20') {
    // Token Configurations
    const erc20Decimals = await getERC20Decimals(erc20TokenAddress, publicClient)
    const erc20Amount = BigInt(10 ** erc20Decimals)

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
    abi: [
      {
        inputs: [
          { internalType: 'address', name: 'to', type: 'address' },
          { internalType: 'uint256', name: 'value', type: 'uint256' },
          { internalType: 'bytes', name: 'data', type: 'bytes' },
          { internalType: 'uint8', name: 'operation', type: 'uint8' },
          { internalType: 'uint256', name: 'safeTxGas', type: 'uint256' },
          { internalType: 'uint256', name: 'baseGas', type: 'uint256' },
          { internalType: 'uint256', name: 'gasPrice', type: 'uint256' },
          { internalType: 'address', name: 'gasToken', type: 'address' },
          { internalType: 'address', name: 'refundReceiver', type: 'address' },
          { internalType: 'bytes', name: 'signatures', type: 'bytes' },
        ],
        name: 'execTransaction',
        outputs: [{ name: 'success', type: 'bool' }],
        payable: true,
        stateMutability: 'external',
        type: 'function',
      },
    ],
    functionName: 'execTransaction',
    args: [setupTxs.to, setupTxs.value, setupTxs.data, setupTxs.operation, 0n, 0n, 0n, zeroAddress, zeroAddress, signature[0].data],
  })

  return callData
}

const getInitializerCode = async ({
  owner,
  addModuleLibAddress,
  safe4337ModuleAddress,
  multiSendAddress,
  erc20TokenAddress,
  paymasterAddress,
}: {
  owner: Address
  addModuleLibAddress: Address
  safe4337ModuleAddress: Address
  multiSendAddress: Address
  erc20TokenAddress: Address
  paymasterAddress: Address
}) => {
  const setupTxs: InternalTx[] = [
    {
      to: addModuleLibAddress,
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

  const multiSendCallData = encodeMultiSend(setupTxs)

  return encodeFunctionData({
    abi: [
      {
        inputs: [
          {
            internalType: 'address[]',
            name: '_owners',
            type: 'address[]',
          },
          {
            internalType: 'uint256',
            name: '_threshold',
            type: 'uint256',
          },
          {
            internalType: 'address',
            name: 'to',
            type: 'address',
          },
          {
            internalType: 'bytes',
            name: 'data',
            type: 'bytes',
          },
          {
            internalType: 'address',
            name: 'fallbackHandler',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'paymentToken',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'payment',
            type: 'uint256',
          },
          {
            internalType: 'address payable',
            name: 'paymentReceiver',
            type: 'address',
          },
        ],
        name: 'setup',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    functionName: 'setup',
    args: [[owner], 1n, multiSendAddress, multiSendCallData, safe4337ModuleAddress, zeroAddress, 0n, zeroAddress],
  })
}

const getGelatoInitializerCode = async ({
  owner,
  publicClient,
  txType,
  addModuleLibAddress,
  safe4337ModuleAddress,
  multiSendAddress,
  erc20TokenAddress,
  erc721TokenAddress,
}: {
  owner: Address
  publicClient: PublicClient
  txType: string
  addModuleLibAddress: Address
  safe4337ModuleAddress: Address
  multiSendAddress: Address
  erc20TokenAddress: Address
  erc721TokenAddress: Address
}) => {
  const setupTxs: InternalTx[] = [
    {
      to: addModuleLibAddress,
      data: enableModuleCallData(safe4337ModuleAddress),
      value: 0n,
      operation: 1, // 1 = DelegateCall required for enabling the module
    },
  ]

  if (txType == 'erc20') {
    // Token Configurations
    const erc20Decimals = await getERC20Decimals(erc20TokenAddress, publicClient)
    const erc20Amount = BigInt(10 ** erc20Decimals)

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
    abi: [
      {
        inputs: [
          {
            internalType: 'address[]',
            name: '_owners',
            type: 'address[]',
          },
          {
            internalType: 'uint256',
            name: '_threshold',
            type: 'uint256',
          },
          {
            internalType: 'address',
            name: 'to',
            type: 'address',
          },
          {
            internalType: 'bytes',
            name: 'data',
            type: 'bytes',
          },
          {
            internalType: 'address',
            name: 'fallbackHandler',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'paymentToken',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'payment',
            type: 'uint256',
          },
          {
            internalType: 'address payable',
            name: 'paymentReceiver',
            type: 'address',
          },
        ],
        name: 'setup',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    functionName: 'setup',
    args: [[owner], 1n, multiSendAddress, multiSendCallData, safe4337ModuleAddress, zeroAddress, 0n, zeroAddress],
  })
}

export const prepareForGelatoTx = async ({
  signer,
  chain,
  publicClient,
  txType,
  senderAddress,
  erc20TokenAddress,
}: {
  signer: PrivateKeyAccount
  chain: string
  publicClient: any
  txType: string
  senderAddress: Address
  erc20TokenAddress: Address
}) => {
  if (txType == 'erc20') {
    // Token Configurations
    const erc20Decimals = await getERC20Decimals(erc20TokenAddress, publicClient)
    const erc20Amount = BigInt(10 ** erc20Decimals)
    let senderERC20Balance = await getERC20Balance(erc20TokenAddress, publicClient, senderAddress)
    console.log('\nSafe Wallet ERC20 Balance:', Number(senderERC20Balance / erc20Amount))

    // Trying to mint tokens (Make sure ERC20 Token Contract is mintable by anyone).
    if (senderERC20Balance < erc20Amount) {
      console.log('\nMinting ERC20 Tokens to Safe Wallet.')
      await mintERC20Token(erc20TokenAddress, publicClient, signer, senderAddress, erc20Amount, chain, 'gelato')

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
    abi: [
      {
        inputs: [
          {
            internalType: 'address[]',
            name: 'modules',
            type: 'address[]',
          },
        ],
        name: 'enableModules',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    functionName: 'enableModules',
    args: [[safe4337ModuleAddress]],
  })
}

export const getAccountInitCode = async ({
  owner,
  addModuleLibAddress,
  safe4337ModuleAddress,
  safeProxyFactoryAddress,
  safeSingletonAddress,
  saltNonce = 0n,
  multiSendAddress,
  erc20TokenAddress,
  paymasterAddress,
}: {
  owner: Address
  addModuleLibAddress: Address
  safe4337ModuleAddress: Address
  safeProxyFactoryAddress: Address
  safeSingletonAddress: Address
  saltNonce?: bigint
  multiSendAddress: Address
  erc20TokenAddress: Address
  paymasterAddress: Address
}): Promise<Hex> => {
  if (!owner) throw new Error('Owner account not found')
  const initializer = await getInitializerCode({
    owner,
    addModuleLibAddress,
    safe4337ModuleAddress,
    multiSendAddress,
    erc20TokenAddress,
    paymasterAddress,
  })

  const initCodeCallData = encodeFunctionData({
    abi: [
      {
        inputs: [
          {
            internalType: 'address',
            name: '_singleton',
            type: 'address',
          },
          {
            internalType: 'bytes',
            name: 'initializer',
            type: 'bytes',
          },
          {
            internalType: 'uint256',
            name: 'saltNonce',
            type: 'uint256',
          },
        ],
        name: 'createProxyWithNonce',
        outputs: [
          {
            internalType: 'contract SafeProxy',
            name: 'proxy',
            type: 'address',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    functionName: 'createProxyWithNonce',
    args: [safeSingletonAddress, initializer, saltNonce],
  })

  return concatHex([safeProxyFactoryAddress, initCodeCallData])
}

export const getGelatoAccountInitCode = async ({
  owner,
  publicClient,
  txType,
  addModuleLibAddress,
  safe4337ModuleAddress,
  safeSingletonAddress,
  saltNonce = 0n,
  multiSendAddress,
  erc20TokenAddress,
  erc721TokenAddress,
}: {
  owner: Address
  publicClient: any
  txType: string
  addModuleLibAddress: Address
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
    publicClient,
    txType,
    addModuleLibAddress,
    safe4337ModuleAddress,
    multiSendAddress,
    erc20TokenAddress,
    erc721TokenAddress,
  })

  const initCodeCallData = encodeFunctionData({
    abi: [
      {
        inputs: [
          {
            internalType: 'address',
            name: '_singleton',
            type: 'address',
          },
          {
            internalType: 'bytes',
            name: 'initializer',
            type: 'bytes',
          },
          {
            internalType: 'uint256',
            name: 'saltNonce',
            type: 'uint256',
          },
        ],
        name: 'createProxyWithNonce',
        outputs: [
          {
            internalType: 'contract SafeProxy',
            name: 'proxy',
            type: 'address',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    functionName: 'createProxyWithNonce',
    args: [safeSingletonAddress, initializer, saltNonce],
  })

  return initCodeCallData
}

export const EIP712_SAFE_OPERATION_TYPE = {
  SafeOp: [
    { type: 'address', name: 'safe' },
    { type: 'uint256', name: 'nonce' },
    { type: 'bytes', name: 'initCode' },
    { type: 'bytes', name: 'callData' },
    { type: 'uint256', name: 'callGasLimit' },
    { type: 'uint256', name: 'verificationGasLimit' },
    { type: 'uint256', name: 'preVerificationGas' },
    { type: 'uint256', name: 'maxFeePerGas' },
    { type: 'uint256', name: 'maxPriorityFeePerGas' },
    { type: 'bytes', name: 'paymasterAndData' },
    { type: 'uint48', name: 'validAfter' },
    { type: 'uint48', name: 'validUntil' },
    { type: 'address', name: 'entryPoint' },
  ],
}

export const encodeCallData = (params: { to: Address; value: bigint; data: `0x${string}` }) => {
  return encodeFunctionData({
    abi: [
      {
        inputs: [
          {
            internalType: 'address',
            name: 'to',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'value',
            type: 'uint256',
          },
          {
            internalType: 'bytes',
            name: 'data',
            type: 'bytes',
          },
          {
            internalType: 'uint8',
            name: 'operation',
            type: 'uint8',
          },
        ],
        name: 'executeUserOp',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    functionName: 'executeUserOp',
    args: [params.to, params.value, params.data, 0],
  })
}

export const getAccountAddress = async ({
  owner,
  client,
  txType = '',
  addModuleLibAddress,
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
  client: any
  txType?: string
  addModuleLibAddress: Address
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
  const proxyCreationCode = await client.readContract({
    abi: [
      {
        inputs: [],
        name: 'proxyCreationCode',
        outputs: [
          {
            internalType: 'bytes',
            name: '',
            type: 'bytes',
          },
        ],
        stateMutability: 'pure',
        type: 'function',
      },
    ],
    address: safeProxyFactoryAddress,
    functionName: 'proxyCreationCode',
  })

  const deploymentCode = encodePacked(['bytes', 'uint256'], [proxyCreationCode, hexToBigInt(safeSingletonAddress)])

  let initializer
  if (isGelato) {
    initializer = await getGelatoInitializerCode({
      owner,
      publicClient: client,
      txType,
      addModuleLibAddress,
      safe4337ModuleAddress,
      multiSendAddress,
      erc20TokenAddress,
      erc721TokenAddress,
    })
  } else {
    initializer = await getInitializerCode({
      owner,
      addModuleLibAddress,
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
