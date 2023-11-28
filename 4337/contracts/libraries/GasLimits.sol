// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";

type GasLimits is uint256;

library GasLimitsLib {
    function parts(
        GasLimits limits
    )
        internal
        pure
        returns (
            uint256 callGasLimit,
            uint256 verificationGasLimit,
            uint256 preVerificationGas,
            uint256 maxFeePerGas,
            uint256 maxPriorityFeePerGas
        )
    {
        unchecked {
            callGasLimit = uint256(GasLimits.unwrap(limits) >> 224);
            verificationGasLimit = uint256(uint32(GasLimits.unwrap(limits) >> 192));
            preVerificationGas = uint256(uint32(GasLimits.unwrap(limits) >> 160));
            maxFeePerGas = uint256(uint80(GasLimits.unwrap(limits) >> 80));
            maxPriorityFeePerGas = uint256(uint80(GasLimits.unwrap(limits)));
        }
    }

    function matches(GasLimits limits, UserOperation calldata userOp) internal pure returns (bool) {
        (
            uint256 callGasLimit,
            uint256 verificationGasLimit,
            uint256 preVerificationGas,
            uint256 maxFeePerGas,
            uint256 maxPriorityFeePerGas
        ) = GasLimitsLib.parts(limits);
        return
            (callGasLimit == 0 || userOp.callGasLimit == callGasLimit) &&
            (verificationGasLimit == 0 || userOp.verificationGasLimit == verificationGasLimit) &&
            (preVerificationGas == 0 || userOp.preVerificationGas == preVerificationGas) &&
            (maxFeePerGas == 0 || userOp.maxFeePerGas == maxFeePerGas) &&
            (maxPriorityFeePerGas == 0 || userOp.maxPriorityFeePerGas == maxPriorityFeePerGas);
    }
}
