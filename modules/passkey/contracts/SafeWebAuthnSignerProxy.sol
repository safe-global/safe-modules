// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;
import {P256, WebAuthn} from "./libraries/WebAuthn.sol";

/**
 * @title WebAuthn Safe Signature Validator
 * @dev A proxy contracy that points to Safe signature validator implementation for a WebAuthn P-256 credential.
 * @custom:security-contact bounty@safe.global
 */
contract SafeWebAuthnSignerProxy {
        
    /**
     * @notice The X coordinate of the P-256 public key of the WebAuthn credential.
     */
    uint256 internal immutable X;
    /**
     * @notice The Y coordinate of the P-256 public key of the WebAuthn credential.
     */
    uint256 internal immutable Y;
    /**
     * @notice The P-256 verifiers used for ECDSA signature validation.
     */
    P256.Verifiers internal immutable VERIFIERS;
    address internal immutable SINGLETON;
    constructor(address implementation, uint256 x, uint256 y, P256.Verifiers verifiers) {
        SINGLETON = implementation;
        X = x;
        Y = y;
        VERIFIERS = verifiers;
    }

    /// @dev Fallback function forwards all transactions and returns all received return data.
    // solhint-disable-next-line no-complex-fallback
    fallback() external payable {
        bytes memory data = abi.encodePacked(msg.data, X, Y, VERIFIERS);
        address _singleton = SINGLETON;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            let dataSize := mload(data)
            let dataLocation := add(data, 0x20)

            let success := delegatecall(gas(), _singleton, dataLocation, dataSize, 0, 0)
            returndatacopy(0, 0, returndatasize())
            if eq(success, 0) {
                revert(0, returndatasize())
            }
            return(0, returndatasize())
        }
    }
}
