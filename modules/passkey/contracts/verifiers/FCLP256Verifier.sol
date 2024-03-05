// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable no-complex-fallback */
/* solhint-disable payable-fallback */
pragma solidity 0.8.24;

import {FCL_ecdsa} from "../vendor/FCL/FCL_ecdsa.sol";
import {IP256Verifier} from "./IP256Verifier.sol";

/**
 * @title P-256 Elliptic Curve Verifier Based on The FreshCryptoLib P-256 Implementation.
 * @custom:security-contact bounty@safe.global
 */
contract FCLP256Verifier is IP256Verifier {
    /**
     * @inheritdoc IP256Verifier
     */
    fallback(bytes calldata input) external returns (bytes memory) {
        if (input.length != 160) {
            return abi.encodePacked(uint256(0));
        }

        bytes32 message;
        uint256 r;
        uint256 s;
        uint256 x;
        uint256 y;

        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            message := calldataload(0)
            r := calldataload(32)
            s := calldataload(64)
            x := calldataload(96)
            y := calldataload(128)
        }

        return abi.encode(FCL_ecdsa.ecdsa_verify(message, r, s, x, y));
    }
}
