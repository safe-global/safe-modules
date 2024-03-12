import { Address, Hex, PublicClient, encodeFunctionData, encodePacked, getContractAddress, hexToBigInt, keccak256, zeroAddress } from 'viem'
import { InternalTx, encodeMultiSend } from './multisend'
import { generateApproveCallData } from './erc20'

// Safe Module Setup & Safe 4337 Module address: https://github.com/safe-global/safe-modules/blob/main/modules/4337/CHANGELOG.md#version-030
// Safe Proxy: https://github.com/safe-global/safe-deployments/blob/main/src/assets/v1.4.1/safe_proxy_factory.json
// Safe Singleton: https://github.com/safe-global/safe-deployments/blob/main/src/assets/v1.4.1/safe.json
export const SAFE_ADDRESSES_MAP = {
  '1.4.1': {
    '5': {
      SAFE_MODULE_SETUP_ADDRESS: '0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47',
      SAFE_4337_MODULE_ADDRESS: '0xfaa6F2eC82BdA7C22220522869E854a3446053A5',
      SAFE_PROXY_FACTORY_ADDRESS: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
      SAFE_SINGLETON_ADDRESS: '0x41675C099F32341bf84BFc5382aF534df5C7461a',
    },
    '80001': {
      SAFE_MODULE_SETUP_ADDRESS: '0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47',
      SAFE_4337_MODULE_ADDRESS: '0xfaa6F2eC82BdA7C22220522869E854a3446053A5',
      SAFE_PROXY_FACTORY_ADDRESS: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
      SAFE_SINGLETON_ADDRESS: '0x41675C099F32341bf84BFc5382aF534df5C7461a',
    },
    '84532': {
      SAFE_MODULE_SETUP_ADDRESS: '0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47',
      SAFE_4337_MODULE_ADDRESS: '0xfaa6F2eC82BdA7C22220522869E854a3446053A5',
      SAFE_PROXY_FACTORY_ADDRESS: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
      SAFE_SINGLETON_ADDRESS: '0x41675C099F32341bf84BFc5382aF534df5C7461a',
    },
    '11155111': {
      SAFE_MODULE_SETUP_ADDRESS: '0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47',
      SAFE_4337_MODULE_ADDRESS: '0xfaa6F2eC82BdA7C22220522869E854a3446053A5',
      SAFE_PROXY_FACTORY_ADDRESS: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
      SAFE_SINGLETON_ADDRESS: '0x41675C099F32341bf84BFc5382aF534df5C7461a',
    },
  },
} as const

// Dummy signature for gas estimation. We require it so the estimation doesn't revert
// if the signature is absent
export const DUMMY_SIGNATURE =
  '0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e043aa8d1b19ca9387bdf05124650baec5c7ed57c04135f915b7a5fac9feeb29783063924cb9712ab0dd42f880317626ea82b4149f81f4e60d8ddeff9109d4619f0000000000000000000000000000000000000000000000000000000000000025a24f744b28d73f066bf3203d145765a7bc735e6328168c8b03e476da3ad0d8fe0400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001e226f726967696e223a2268747470733a2f2f736166652e676c6f62616c220000'

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
  safeModuleSetupAddress,
  safe4337ModuleAddress,
  safeProxyFactoryAddress,
  safeSingletonAddress,
  saltNonce = 0n,
  multiSendAddress,
  erc20TokenAddress,
  paymasterAddress,
}: {
  owner: Address
  safeModuleSetupAddress: Address
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
    safeModuleSetupAddress,
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

  // return concatHex([safeProxyFactoryAddress, initCodeCallData])
  return initCodeCallData
}

export const EIP712_SAFE_OPERATION_TYPE = {
  SafeOp: [
    { type: 'address', name: 'safe' },
    { type: 'uint256', name: 'nonce' },
    { type: 'bytes', name: 'initCode' },
    { type: 'bytes', name: 'callData' },
    { type: 'uint128', name: 'verificationGasLimit' },
    { type: 'uint128', name: 'callGasLimit' },
    { type: 'uint256', name: 'preVerificationGas' },
    { type: 'uint128', name: 'maxPriorityFeePerGas' },
    { type: 'uint128', name: 'maxFeePerGas' },
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
  client,
  owner,
  safeModuleSetupAddress,
  safe4337ModuleAddress,
  safeProxyFactoryAddress,
  safeSingletonAddress,
  saltNonce = 0n,
  multiSendAddress,
  erc20TokenAddress,
  paymasterAddress,
}: {
  client: PublicClient
  owner: Address
  safeModuleSetupAddress: Address
  safe4337ModuleAddress: Address
  safeProxyFactoryAddress: Address
  safeSingletonAddress: Address
  saltNonce?: bigint
  multiSendAddress: Address
  erc20TokenAddress: Address
  paymasterAddress: Address
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

  const initializer = await getInitializerCode({
    owner,
    safeModuleSetupAddress,
    safe4337ModuleAddress,
    multiSendAddress,
    erc20TokenAddress,
    paymasterAddress,
  })

  const salt = keccak256(encodePacked(['bytes32', 'uint256'], [keccak256(encodePacked(['bytes'], [initializer])), saltNonce]))

  return getContractAddress({
    from: safeProxyFactoryAddress,
    salt,
    bytecode: deploymentCode,
    opcode: 'CREATE2',
  })
}
