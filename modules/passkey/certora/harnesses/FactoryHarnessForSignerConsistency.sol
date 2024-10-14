// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {SafeWebAuthnSignerFactory} from "../munged/FactoryForSignerConsistency.sol";
import {P256} from "../../contracts/libraries/P256.sol";
import {SafeWebAuthnSignerProxy} from "../../contracts/SafeWebAuthnSignerProxy.sol";

contract FactoryHarnessForSignerConsistency is SafeWebAuthnSignerFactory {
    //Harness
    function hasNoCode(address account) external view returns (bool result) {
        // solhint-disable-next-line no-inline-assembly
        return SafeWebAuthnSignerFactory._hasNoCode(account);
    }

    function createAndVerify(
        bytes32 message,
        bytes calldata signature,
        uint256 x,
        uint256 y,
        P256.Verifiers verifiers
    ) external returns (bytes4 magicValue) {
        address signer = this.createSigner(x, y, verifiers);

        bytes memory data = abi.encodeWithSignature("isValidSignature(bytes32,bytes)", message, signature);

        // Use low-level call to invoke isValidSignature on the signer address
        (bool success, bytes memory result) = signer.staticcall(data);
        require(success);
        magicValue = abi.decode(result, (bytes4));
    }

    /**
        munge to pass the SignerCreationCantOverride rule.
     */
    function _hasNoCode(address account) internal view override returns (bool result) {
        return account.code.length == 0;
    }
}
