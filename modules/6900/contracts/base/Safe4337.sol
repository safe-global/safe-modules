// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.23;

import {Safe4337Module} from "@safe-global/safe-4337/contracts/Safe4337Module.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {ISafe} from "../interfaces/ISafe.sol";
import {Base6900} from "./Base6900.sol";

contract Safe4337 is Safe4337Module, Base6900 {
    constructor(address _entryPoint) Safe4337Module(_entryPoint) {}

    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32,
        uint256 missingAccountFunds
    ) external override onlySupportedEntryPoint returns (uint256 validationData) {
        (bool success, bytes memory data) = ISafe(userOp.sender).execTransactionFromModuleReturnData(
            payable(address(this)),
            0,
            abi.encodeWithSelector(Safe4337.validateUserOpDelegatecallReciever.selector, userOp, missingAccountFunds),
            1 // delegatecall
        );

        if (!success) {
            if (data.length == 0) revert();
            assembly {
                // We use Yul's revert() to bubble up errors from the target contract.
                revert(add(32, data), mload(data))
            }
        }

        validationData = abi.decode(data, (uint256));
    }

    function validateUserOpDelegatecallReciever(
        PackedUserOperation calldata userOp,
        bytes32,
        uint256 missingAccountFunds
    ) external onlyDelegateCall returns (uint256 validationData) {
        address payable safeAddress = payable(userOp.sender);
        // The entry point address is appended to the calldata by the Safe in the `FallbackManager` contract,
        // following ERC-2771. Because of this, the relayer may manipulate the entry point address, therefore
        // we have to verify that the sender is the Safe specified in the userOperation.
        if (safeAddress != msg.sender) {
            revert InvalidCaller();
        }

        // We check the execution function signature to make sure the entry point can't call any other function
        // and make sure the execution of the user operation is handled by the module
        bytes4 selector = bytes4(userOp.callData);
        if (selector != this.executeUserOp.selector && selector != this.executeUserOpWithErrorString.selector) {
            revert UnsupportedExecutionFunction(selector);
        }

        // The userOp nonce is validated in the entry point (for 0.6.0+), therefore we will not check it again
        validationData = _validateSignatures(userOp);

        // We trust the entry point to set the correct prefund value, based on the operation params
        // We need to perform this even if the signature is not valid, else the simulation function of the entry point will not work.
        if (missingAccountFunds != 0) {
            // We intentionally ignore errors in paying the missing account funds, as the entry point is responsible for
            // verifying the prefund has been paid. This behaviour matches the reference base account implementation.
            ISafe(safeAddress).execTransactionFromModule(SUPPORTED_ENTRYPOINT, missingAccountFunds, "", 0);
        }
    }
}
