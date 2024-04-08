// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;
import {SafeProxy} from "@safe-global/safe-contracts/contracts/proxies/SafeProxy.sol";

contract SafeWebAuthnSignerProxy is SafeProxy {
    constructor(address implementation) SafeProxy(implementation) {}
}
