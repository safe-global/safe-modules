export const ERC20_TOKEN_APPROVE_ABI = [
  {
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

export const ERC20_TOKEN_TRANSFER_ABI = [
  {
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

export const ERC20_TOKEN_DECIMALS_ABI = [
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ type: 'uint8' }],
    type: 'function',
    stateMutability: 'view',
  },
]

export const ERC20_TOKEN_BALANCE_OF_ABI = [
  {
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
    stateMutability: 'view',
  },
]

export const ERC20_TOKEN_MINT_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'mint',
    outputs: [],
    type: 'function',
    stateMutability: 'public',
  },
]

export const ERC721_TOKEN_SAFEMINT_ABI = [
  {
    inputs: [{ name: '_to', type: 'address' }],
    name: 'safeMint',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

export const MULTISEND_ABI = [
  {
    inputs: [{ internalType: 'bytes', name: 'transactions', type: 'bytes' }],
    name: 'multiSend',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
]

export const SAFE_NONCE_ABI = [
  {
    inputs: [],
    name: 'nonce',
    outputs: [{ type: 'uint256' }],
    type: 'function',
    stateMutability: 'view',
  },
]

export const SAFE_EXECTRANSACTION_ABI = [
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
]

export const SAFE_SETUP_ABI = [
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
]

export const SAFE_ENABLE_MODULES_ABI = [
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
]

export const SAFE_FACTORY_CREATE_PROXY_WITH_NONCE_ABI = [
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
]

export const SAFE_4337_EXECUTE_USEROP_ABI = [
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
]

export const SAFE_FACTORY_PROXY_CREATION_CODE_ABI = [
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
]
