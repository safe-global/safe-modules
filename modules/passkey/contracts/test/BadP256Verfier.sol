// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable no-complex-fallback */
/* solhint-disable payable-fallback */
pragma solidity ^0.8.0;

import {IP256Verifier} from "../interfaces/IP256Verifier.sol";

contract BadP256Verifier is IP256Verifier {
    enum Behaviour {
        WRONG_RETURNDATA_LENGTH,
        INVALID_BOOLEAN_VALUE,
        REVERT
    }

    Behaviour public immutable BEHAVIOUR;

    constructor(Behaviour behaviour) {
        BEHAVIOUR = behaviour;
    }

    fallback(bytes calldata) external returns (bytes memory output) {
        if (BEHAVIOUR == Behaviour.WRONG_RETURNDATA_LENGTH) {
            output = abi.encode(true, 0);
        } else if (BEHAVIOUR == Behaviour.INVALID_BOOLEAN_VALUE) {
            output = abi.encode(-1);
        } else if (BEHAVIOUR == Behaviour.REVERT) {
            // solhint-disable-next-line no-inline-assembly
            assembly ("memory-safe") {
                mstore(0, 1)
                revert(0, 32)
            }
        }
    }
}
