// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable no-complex-fallback */
pragma solidity ^0.8.20;

import {P256} from "./libraries/WebAuthn.sol";

/**
 * @title Safe WebAuthn Signer Proxy
 * @dev A specialized proxy to a {SafeWebAuthnSignerSingleton} signature validator implementation
 * for Safe accounts. Using a proxy pattern for the signature validator greatly reduces deployment
 * gas costs.
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
        address singleton = _SINGLETON;
        uint256 x = _X;
        uint256 y = _Y;
        P256.Verifiers verifiers = _VERIFIERS;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            // Forward the call to the singleton implementation. We append the configuration to the
            // calldata instead of having the singleton implementation read it from storage. This is
            // both more gas efficient and required for ERC-4337 compatibility. Note that we append
            // the configuration fields in reverse order since the fields are packed, and this makes
            // it so we don't need to mask any bits from the `verifiers` value. This computes `data`
            // to be `abi.encodePacked(msg.data, x, y, verifiers)`.
            let data := mload(0x40)
            mstore(add(data, add(calldatasize(), 0x36)), verifiers)
            mstore(add(data, add(calldatasize(), 0x20)), y)
            mstore(add(data, calldatasize()), x)
            calldatacopy(data, 0x00, calldatasize())

            let success := delegatecall(gas(), singleton, data, add(calldatasize(), 0x56), 0, 0)
            returndatacopy(0, 0, returndatasize())
            if iszero(success) {
                revert(0, returndatasize())
            }
            return(0, returndatasize())
        }
    }
}
