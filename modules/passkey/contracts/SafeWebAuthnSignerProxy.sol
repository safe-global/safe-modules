// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable no-complex-fallback */
pragma solidity >=0.8.0;

import {P256} from "./libraries/WebAuthn.sol";

/**
 * @title Safe WebAuthn Signer Proxy
 * @dev A proxy to a {SafeWebAuthnSignerSingleton} signature validator implementation for Safe
 * accounts. Using a proxy pattern for the signature validator greatly reduces deployment gas costs.
 * @custom:security-contact bounty@safe.global
 */
contract SafeWebAuthnSignerProxy {
    /**
     * @notice The {SafeWebAuthnSignerSingleton} implementation to proxy to.
     */
    address internal immutable _SINGLETON;

    /**
     * @notice The x coordinate of the P-256 public key of the WebAuthn credential.
     */
    uint256 internal immutable _X;

    /**
     * @notice The y coordinate of the P-256 public key of the WebAuthn credential.
     */
    uint256 internal immutable _Y;

    /**
     * @notice The P-256 verifiers used for ECDSA signature verification.
     */
    P256.Verifiers internal immutable _VERIFIERS;

    /**
     * @notice Creates a new WebAuthn Safe Signer Proxy.
     * @param singleton The {SafeWebAuthnSignerSingleton} implementation to proxy to.
     * @param x The x coordinate of the P-256 public key of the WebAuthn credential.
     * @param y The y coordinate of the P-256 public key of the WebAuthn credential.
     * @param verifiers The P-256 verifiers used for ECDSA signature verification.
     */
    constructor(address singleton, uint256 x, uint256 y, P256.Verifiers verifiers) {
        _SINGLETON = singleton;
        _X = x;
        _Y = y;
        _VERIFIERS = verifiers;
    }

    /**
     * @dev Fallback function forwards all transactions and returns all received return data.
     */
    fallback() external payable {
        bytes memory data = abi.encodePacked(msg.data, _X, _Y, _VERIFIERS);
        address singleton = _SINGLETON;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            let dataSize := mload(data)
            let dataLocation := add(data, 0x20)

            let success := delegatecall(gas(), singleton, dataLocation, dataSize, 0, 0)
            returndatacopy(0, 0, returndatasize())
            if iszero(success) {
                revert(0, returndatasize())
            }
            return(0, returndatasize())
        }
    }
}
