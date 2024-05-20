// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {SafeWebAuthnSignerFactory} from "../../modules/passkey/contracts/SafeWebAuthnSignerFactory.sol";
import {P256} from "../../modules/passkey/contracts/libraries/P256.sol";
import {SafeWebAuthnSignerProxy} from "../../modules/passkey/contracts/SafeWebAuthnSignerProxy.sol";


contract SafeWebAuthnSignerFactoryHarness is SafeWebAuthnSignerFactory {
   
    //Harness
    function hasNoCode(address account) external view returns (bool result) {
        // solhint-disable-next-line no-inline-assembly
        return SafeWebAuthnSignerFactory._hasNoCode(account);
    }
}
