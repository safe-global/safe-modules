import { bundlerRpc, prepareAccounts, waitForUserOp } from '@safe-global/safe-4337-local-bundler'
import { expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import {
  SafeSignature,
  SafeTransaction,
  SignedSafeTransaction,
  buildSignatureBytes,
  calculateSafeMessageHash,
  calculateSafeTransactionHash,
  getPrevalidatedSignature,
  preimageSafeMessageHash,
  preimageSafeTransactionHash,
  signHash,
} from '../../src/utils/execution'
import {
  buildRpcUserOperationFromSafeUserOperation,
  buildSafeUserOpTransaction,
  signSafeOp,
  SafeUserOperation,
} from '../../src/utils/userOp'
import { chainId } from '../utils/encoding'
import { Safe4337 } from '../../src/utils/safe'
import { BigNumberish, Signer } from 'ethers'
import { assert } from 'console'

// Set to true to enable global debug logs
const ENABLE_GLOBAL_DEBUG = false

/**
 * Represents a node in the ownership tree of a Safe4337.
 */
class SafeOwnershipTreeNode {
  /**
   * Creates an instance of SafeOwnershipTreeNode.
   * @param value - The Safe4337 value associated with this node.
   * @param owners - An array of owners of this node, which can be either SafeOwnershipTreeNode or SafeOwnershipTreeEoaNode instances.
   */
  constructor(
    public value: Safe4337,
    public owners: (SafeOwnershipTreeNode | SafeOwnershipTreeEoaNode)[],
  ) {}
}

/**
 * Represents a node in the Safe Ownership Tree for an externally owned account (EOA).
 */
class SafeOwnershipTreeEoaNode {
  constructor(public value: Signer) {}
}

/**
 * Represents a tree structure that holds ownership information of a safe.
 */
class SafeOwnershipTree {
  constructor(public root: SafeOwnershipTreeNode) {}
}

/**
 * Recursively walks the ownership tree and deploys all nodes.
 * A utility function for tests that require all nodes in the ownership tree to be deployed.
 *
 * @param {SafeOwnershipTreeNode} node - The root node of the ownership tree.
 * @param {Signer} deployer - The signer used for deployment.
 */
const walkTreeAndDeployAll = async (node: SafeOwnershipTreeNode, deployer: Signer): Promise<void> => {
  await node.value.deploy(deployer)

  for (const owner of node.owners) {
    if (owner instanceof SafeOwnershipTreeNode) {
      await walkTreeAndDeployAll(owner, deployer)
    }
  }
}

/**
 * Prints the tree structure of SafeOwnershipTreeNode recursively.
 *
 * @param {SafeOwnershipTreeNode} node - The root node of the tree.
 * @param {number} depth - The current depth of the node in the tree.
 */
const printTree = async (node: SafeOwnershipTreeNode, depth: number): Promise<void> => {
  console.log('  '.repeat(depth) + node.value.address)
  for (const owner of node.owners) {
    if (owner instanceof SafeOwnershipTreeNode) {
      await printTree(owner, depth + 1)
    } else {
      console.log('  '.repeat(depth + 1) + (await owner.value.getAddress()))
    }
  }
}

/**
 * Prints the execution path of a SafeOwnershipTreeNode array.
 *
 * @param {SafeOwnershipTreeNode[]} executionPath - The array of SafeOwnershipTreeNode representing the execution path.
 */
const printExecutionPath = (executionPath: SafeOwnershipTreeNode[]): void => {
  const executorAddress = executionPath[executionPath.length - 1].value.address
  const path = executionPath
    .slice(1, -1)
    .map((node) => node.value.address)
    .join('  ->  ')
  const rootAddress = executionPath[0].value.address

  console.log(`${executorAddress} (4337 Executor)  ->  ${path}  -> ${rootAddress} (Root)`)
}

/**
 * Checks if a given node is owned by EOAs only. Such nodes are considered leaf nodes in the ownership tree.
 * @param node - The SafeOwnershipTreeNode to check.
 * @returns {boolean} Returns true if the node is owned by EOAs only, false otherwise.
 */
const isOwnedByEoasOnly = (node: SafeOwnershipTreeNode): boolean => {
  return node.owners.every((owner) => owner instanceof SafeOwnershipTreeEoaNode)
}

/**
 * Recursively signs a hash using the owners of a SafeOwnershipTreeNode. Should only be called if the signer is a Safe.
 *
 * @param {SafeOwnershipTreeNode} safe - The SafeOwnershipTreeNode representing the Safe.
 * @param {string} hash - The hash to be signed.
 * @param {BigNumberish} chainId - The chain ID.
 * @returns {Promise<SafeSignature>} A Promise that resolves to a SafeSignature object.
 */
const recursivelySignHashWithASafe = async (safe: SafeOwnershipTreeNode, hash: string, chainId: BigNumberish): Promise<SafeSignature> => {
  const signatures = []

  for (const owner of safe.owners) {
    if (owner instanceof SafeOwnershipTreeEoaNode) {
      const safeMsgHash = calculateSafeMessageHash(safe.value.address, hash, chainId)
      signatures.push(await signHash(owner.value, safeMsgHash))
    } else {
      // When Safe contract validates the signatures, it uses the pre-image of the hash to validate the signature (legacy EIP-1271 behaviour),
      // hence we're computing the pre-image of the hash here.
      const preImageSafeMsgHash = preimageSafeMessageHash(safe.value.address, hash, chainId)
      signatures.push(await recursivelySignHashWithASafe(owner, preImageSafeMsgHash, chainId))
    }
  }

  return {
    signer: safe.value.address,
    data: buildSignatureBytes(signatures),
    dynamic: true,
  }
}

/**
 * Retrieves the execution path from the executor (leaf node) to the root node in a SafeOwnershipTreeNode tree.
 *
 * @param {SafeOwnershipTreeNode} rootSafe The root node of the SafeOwnershipTreeNode tree.
 * @returns {SafeOwnershipTreeNode[]} An array of SafeOwnershipTreeNode objects representing the execution path. The first element is the root node and the last element is the executor.
 */
const getExecutionPath = (rootSafe: SafeOwnershipTreeNode): SafeOwnershipTreeNode[] => {
  const executionPath = []
  // We need to build an execution path from the executor (leaf node) to the root node
  // To do so, we need to traverse the tree from the root to the executor
  // The executor is the first leaf node found or the last node in the execution path
  // This algorithm doesn't produce the shortest path, but it's guaranteed to find the executor (if it exists in the tree)
  // For further optimization, we can use a breadth-first search algorithm to find the executor
  let currentNode = rootSafe
  // eslint-disable-next-line no-constant-condition
  while (true) {
    executionPath.push(currentNode)
    if (isOwnedByEoasOnly(currentNode)) {
      // We found the executor
      break
    } else {
      const owners = currentNode.owners
      for (const owner of owners) {
        if (owner instanceof SafeOwnershipTreeNode) {
          currentNode = owner
          break
        }
      }
    }
  }

  return executionPath
}

/**
 * Checks if a node is present in the execution path. Root node is not considered part of the execution path
 * because it is rather an execution target.
 * @param executionPath - The execution path as an array of SafeOwnershipTreeNode objects.
 * @param node - The node to check for presence in the execution path.
 * @returns A boolean indicating whether the node is present in the execution path.
 */
const isNodeInExecutionPath = (executionPath: SafeOwnershipTreeNode[], node: SafeOwnershipTreeNode): boolean => {
  const index = executionPath.findIndex((n) => n.value.address === node.value.address)

  return index !== -1 && index !== 0
}

/**
 * Builds a nested safe operation from a SafeTransaction, a root safe, an execution path and an entry point address.
 * The algorithm works as follows:
 * 1. For each node in the execution path, we create a Safe transaction and sign it with the owners of the node:
 *    a. If the owner is an EOA, we sign the transaction with the EOA's private key.
 *    b. If the owner is a Safe, we recursively sign the transaction with the Safe's owners.
 *    c. If the owner is in the execution path, we sign the transaction with a pre-validated signature (the one that checks that msg.sender is an owner)
 * 2. We then build a SafeUserOperation that calls into the starting point of the execution path (a node before the executor 4337 Safe)
 *
 * @param {SafeTransaction} safeTx - The safe transaction.
 * @param {SafeOwnershipTreeNode} rootSafe - The root safe in the ownership tree.
 * @param {SafeOwnershipTreeNode[]} executionPath - The execution path of the safe ownership tree nodes.
 * @param {string} entryPointAddress - The entry point address.
 * @returns {Promise<SafeUserOperation>} A promise that resolves to a SafeUserOperation.
 */
const buildNestedSafeOp = async (
  safeTx: SafeTransaction,
  rootSafe: SafeOwnershipTreeNode,
  executionPath: SafeOwnershipTreeNode[],
  entryPointAddress: string,
): Promise<SafeUserOperation> => {
  const transactions: SignedSafeTransaction[] = [{ ...safeTx, signatures: [] }]

  // We iterate over executionPath.length - 1 because the last node in the execution path is the executor
  // And will be handled as a special case after the loop (it needs a UserOperation instead of SafeTransaction)
  for (let i = 0; i < executionPath.length - 1; i++) {
    if (i === 0) {
      assert(executionPath[i].value.address === rootSafe.value.address, 'First node in the execution path should be the root node')
    }

    const node = executionPath[i]
    // There will be (amount(executionPathNodes) - 1) Safe transactions because the last node in the execution path is the executor
    // And will be handled as a special case after the loop (it needs a UserOperation instead of SafeTransaction)
    const transaction = transactions[i]
    for (const owner of node.owners) {
      if (owner instanceof SafeOwnershipTreeEoaNode) {
        const safeTxHash = calculateSafeTransactionHash(executionPath[i].value.address, transaction, await chainId())
        transaction.signatures.push(await signHash(owner.value, safeTxHash))
      } else {
        // If the node is in the execution path, that means it will be executing an ethereum CALL and will be a msg.sender
        // Hence we sign the transaction with a pre-validated signature (the one that checks that msg.sender is an owner)
        if (isNodeInExecutionPath(executionPath, owner)) {
          transaction.signatures.push(getPrevalidatedSignature(owner.value.address))
        } else {
          // If the owner node is not in the execution path and a Safe, we recursively sign the transaction with the Safe's owners.
          // When Safe contract validates the signatures, it uses the pre-image of the transaction hash to validate the signature (legacy EIP-1271 behaviour),
          // hence we're computing the pre-image of the transaction hash here.
          const preimageSafeTxHash = preimageSafeTransactionHash(executionPath[i].value.address, transaction, await chainId())
          transaction.signatures.push(await recursivelySignHashWithASafe(owner, preimageSafeTxHash, await chainId()))
        }
      }
    }

    // After we signed the transaction, we need to generate the next Safe transaction for the next node in the execution path
    // We do not need to generate it for the last two nodes in the execution path because the last node will be the executor
    // And the preceeding node will be the starting point of the execution path and both will be handled as special cases after the loop
    if (i < executionPath.length - 2) {
      const newTransaction: SignedSafeTransaction = {
        to: node.value.address,
        value: 0,
        data: Safe4337.getExecTransactionData(transaction),
        operation: 0,
        safeTxGas: 0,
        baseGas: 0,
        gasPrice: 0,
        gasToken: ethers.ZeroAddress,
        refundReceiver: ethers.ZeroAddress,
        nonce: 0,
        signatures: [],
      }
      transactions.push(newTransaction)
    }
  }

  if (ENABLE_GLOBAL_DEBUG) {
    console.dir({ transactions }, { depth: null })
  }

  const executor = executionPath[executionPath.length - 1]
  const executionStartPoint = executionPath[executionPath.length - 2]
  const entryTransaction = transactions[transactions.length - 1]
  const entryTransactionCopy = {
    ...entryTransaction,
    signatures: [getPrevalidatedSignature(executor.value.address)],
  }

  return buildSafeUserOpTransaction(
    executor.value.address,
    executionStartPoint.value.address,
    0,
    Safe4337.getExecTransactionData(entryTransactionCopy),
    0,
    entryPointAddress,
    false,
    true,
  )
}

describe('Nested Safes With An Execution Initiated by a Leaf 4337 Safe [@4337]', () => {
  before(function () {
    if (network.name !== 'localhost') {
      this.skip()
    }
  })

  const setupTests = async () => {
    const { SafeModuleSetup, EntryPoint, HariWillibaldToken, Safe4337Module, SafeL2, SafeProxyFactory } = await deployments.run()
    const [user, user2, user3] = await prepareAccounts({ count: 3 })
    const bundler = bundlerRpc()

    const entryPoint = new ethers.Contract(EntryPoint.address, EntryPoint.abi, ethers.provider)
    const validator = await ethers.getContractAt('Safe4337Module', Safe4337Module.address)
    const token = await ethers.getContractAt('HariWillibaldToken', HariWillibaldToken.address)
    const proxyFactory = await ethers.getContractAt('SafeProxyFactory', SafeProxyFactory.address)
    const proxyCreationCode = await proxyFactory.proxyCreationCode()

    const leafSafe = new SafeOwnershipTreeNode(
      Safe4337.withSigner(user.address, {
        safeSingleton: SafeL2.address,
        entryPoint: EntryPoint.address,
        erc4337module: Safe4337Module.address,
        proxyFactory: SafeProxyFactory.address,
        safeModuleSetup: SafeModuleSetup.address,
        proxyCreationCode,
        chainId: Number(await chainId()),
      }),
      [new SafeOwnershipTreeEoaNode(user)],
    )
    const leafSafe2 = new SafeOwnershipTreeNode(
      Safe4337.withSigner(user2.address, {
        safeSingleton: SafeL2.address,
        entryPoint: EntryPoint.address,
        erc4337module: Safe4337Module.address,
        proxyFactory: SafeProxyFactory.address,
        safeModuleSetup: SafeModuleSetup.address,
        proxyCreationCode,
        chainId: Number(await chainId()),
      }),
      [new SafeOwnershipTreeEoaNode(user2)],
    )
    const leafEoa = new SafeOwnershipTreeEoaNode(user3)
    const nodeSafe = new SafeOwnershipTreeNode(
      Safe4337.withSigner(leafSafe.value.address, {
        safeSingleton: SafeL2.address,
        entryPoint: EntryPoint.address,
        erc4337module: Safe4337Module.address,
        proxyFactory: SafeProxyFactory.address,
        safeModuleSetup: SafeModuleSetup.address,
        proxyCreationCode,
        chainId: Number(await chainId()),
      }),
      [leafSafe],
    )
    const rootSafe = new SafeOwnershipTreeNode(
      Safe4337.withSigners([nodeSafe.value.address, leafSafe2.value.address, await leafEoa.value.getAddress()], 3, {
        safeSingleton: SafeL2.address,
        entryPoint: EntryPoint.address,
        erc4337module: Safe4337Module.address,
        proxyFactory: SafeProxyFactory.address,
        safeModuleSetup: SafeModuleSetup.address,
        proxyCreationCode,
        chainId: Number(await chainId()),
      }),
      [nodeSafe, leafSafe2, leafEoa],
    )
    const tree = new SafeOwnershipTree(rootSafe)

    return {
      user,
      bundler,
      tree,
      validator,
      entryPoint,
      token,
    }
  }

  it('should execute a transaction for an existing Safe', async () => {
    const { user, bundler, tree, validator, entryPoint, token } = await setupTests()

    const executionPath = getExecutionPath(tree.root)

    if (ENABLE_GLOBAL_DEBUG) {
      console.log('===    Tree structure:   ===')
      await printTree(tree.root, 0)
      console.log('===    Tree structure end    ===')
      printExecutionPath(executionPath)
    }

    await walkTreeAndDeployAll(tree.root, user)
    const executor = executionPath[executionPath.length - 1]
    const rootSafe = tree.root.value

    await token.transfer(rootSafe.address, ethers.parseUnits('4.2', 18)).then((tx) => tx.wait())
    await user.sendTransaction({ to: executor.value.address, value: ethers.parseEther('1') }).then((tx) => tx.wait())

    expect(ethers.dataLength(await ethers.provider.getCode(rootSafe.address))).to.not.equal(0)
    expect(await token.balanceOf(rootSafe.address)).to.equal(ethers.parseUnits('4.2', 18))

    const safeTransaction: SafeTransaction = {
      to: await token.getAddress(),
      value: 0,
      data: token.interface.encodeFunctionData('transfer', [user.address, await token.balanceOf(rootSafe.address)]),
      operation: 0,
      safeTxGas: 0,
      baseGas: 0,
      gasPrice: 0,
      gasToken: ethers.ZeroAddress,
      refundReceiver: ethers.ZeroAddress,
      nonce: 0,
    }

    assert(executor.owners[0] instanceof SafeOwnershipTreeEoaNode, 'Executor should be an EOA')
    const executorSigner = executor.owners[0].value as Signer
    const safeOp = await buildNestedSafeOp(safeTransaction, tree.root, executionPath, await entryPoint.getAddress())
    const signature = buildSignatureBytes([await signSafeOp(executorSigner, await validator.getAddress(), safeOp, await chainId())])
    const userOp = await buildRpcUserOperationFromSafeUserOperation({
      safeOp,
      signature,
    })

    if (ENABLE_GLOBAL_DEBUG) {
      console.dir({ userOp }, { depth: null })
    }

    const receiptHash = await bundler.sendUserOperation(userOp, await entryPoint.getAddress())
    await waitForUserOp(userOp)

    if (ENABLE_GLOBAL_DEBUG) {
      console.dir(await bundler.send('eth_getUserOperationReceipt', [receiptHash]), { depth: null })
    }
    expect(await token.balanceOf(rootSafe.address)).to.equal(0n)
  })

  it.skip('should deploy a new Safe and execute a transaction', async () => {
    // TODO: Implement this test. This test will take more effort because the above algorithm will need to be adjusted
    // to use the CreateCall contract from the Safe Contract suite.
  })
})
