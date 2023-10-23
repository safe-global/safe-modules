// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import {UserOperation} from "../interfaces/ERC4337.sol";

library UserOperationLib {
    function requiredGas(UserOperation calldata userOp) internal pure returns (uint256) {
        unchecked {
            //when using a Paymaster, the verificationGas is used also to cover the postOp call.
            // our security model might call postOp eventually twice
            uint256 mul = hasPaymaster(userOp) ? 3 : 1;
            return userOp.callGasLimit + userOp.verificationGasLimit * mul + userOp.preVerificationGas;
        }
    }

    function requiredPreFund(UserOperation calldata userOp) internal pure returns (uint256 prefund) {
        unchecked {
            return requiredGas(userOp) * userOp.maxFeePerGas;
        }
    }

    function hasPaymaster(UserOperation calldata userOp) internal pure returns (bool) {
        return userOp.paymasterAndData.length > 0;
    }
}
