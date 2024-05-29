// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable no-complex-fallback */
pragma solidity >=0.8.0;

import {P256} from "../../modules/passkey/contracts/libraries/WebAuthn.sol";
import {SafeWebAuthnSignerProxy} from "../../modules/passkey/contracts/SafeWebAuthnSignerProxy.sol";

/**
 * @title Safe WebAuthn Signer Proxy Harness
 * @dev This harness is written to be able to prove a certain property on the fallback function.
 * The property we are proving using this harness is that no combination of x, y and verifiers can make the fallback revert
 * due the problems with the untrivial data appanding.
 * It adds another function `fallbackButNotDelegating which has the exact same functionality as the original fallback
 * but it gets the x, y, and verifiers parameters instead of reading the immutable ones and does not make a delegatecall.
 */
contract SafeWebAuthnSignerProxyHarness is SafeWebAuthnSignerProxy { 
    /**
     * @notice Creates a new WebAuthn Safe Signer Proxy.
     * @param singleton The {SafeWebAuthnSignerSingleton} implementation to proxy to.
     * @param x The x coordinate of the P-256 public key of the WebAuthn credential.
     * @param y The y coordinate of the P-256 public key of the WebAuthn credential.
     * @param verifiers The P-256 verifiers used for ECDSA signature verification.
     */
    constructor(address singleton, uint256 x, uint256 y, P256.Verifiers verifiers)
        SafeWebAuthnSignerProxy(singleton, x, y, verifiers) { }

    /**
     * @dev Fallback function forwards all transactions and returns all received return data.
     */
    function fallbackButNotDelegating(uint256 x, uint256 y, P256.Verifiers verifiers) external payable returns (bytes4) {
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

            let success := true
            returndatacopy(0, 0, returndatasize())
            if iszero(success) {
                revert(0, returndatasize())
            }
            return(0, returndatasize())
        }
    }
}
