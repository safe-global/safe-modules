// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;
import {IP256Verifier} from "./interfaces/IP256Verifier.sol";

/**
 * @title SafeWebAuthnSignerProxy
 * @dev A proxy contract that points to SafeWebAuthnSigner.
 */
contract SafeWebAuthnSignerProxy {
    uint256 internal immutable X;
    uint256 internal immutable Y;
    IP256Verifier internal immutable VERIFIER;
    address internal immutable SINGLETON;
    constructor(address implementation, uint256 x, uint256 y, address verifier) {
        SINGLETON = implementation;
        X = x;
        Y = y;
        VERIFIER = IP256Verifier(verifier);
    }

    /// @dev Fallback function forwards all transactions and returns all received return data.
    // solhint-disable-next-line no-complex-fallback
    fallback() external payable {
        bytes memory data = abi.encodePacked(msg.data, X, Y, VERIFIER);
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
