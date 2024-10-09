// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable no-complex-fallback */
pragma solidity >=0.8.0;

import {SafeWebAuthnSignerProxy} from "../../contracts/SafeWebAuthnSignerProxy.sol";

contract ProxySimulator {
    address internal _proxy;

    constructor(address proxy) {
        _proxy = proxy;
    }

    function authenticate(bytes32 message, bytes calldata signature) external returns (bytes4) {
        bytes memory data = abi.encodeWithSignature("isValidSignature(bytes32,bytes)", message, signature);

        (bool success, bytes memory result) = _proxy.call(data);

        require(success);

        return abi.decode(result, (bytes4));
    }
}
