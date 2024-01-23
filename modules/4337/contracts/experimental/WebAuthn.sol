// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {FCL_ecdsa_utils} from "../vendor/FCL/FCL_ecdsa_utils.sol";
import {Base64Url} from "../vendor/FCL/utils/Base64Url.sol";

library WebAuthn {
    function signingMessage(
        bytes calldata authenticatorData,
        bytes32 challenge,
        bytes calldata clientDataFields
    ) internal pure returns (bytes32 message) {
        string memory encodedChallenge = Base64Url.encode(abi.encodePacked(challenge));
        /* solhint-disable quotes */
        bytes memory clientDataJson = abi.encodePacked(
            '{"type":"webauthn.get","challenge":"',
            encodedChallenge,
            '",',
            clientDataFields,
            "}"
        );
        /* solhint-enable quotes */
        message = sha256(abi.encodePacked(authenticatorData, sha256(clientDataJson)));
    }

    function checkSignature(
        bytes calldata authenticatorData,
        bytes1 authenticatorFlags,
        bytes32 challenge,
        bytes calldata clientDataFields,
        uint256[2] calldata rs,
        uint256 qx,
        uint256 qy
    ) internal view returns (bool result) {
        // check authenticator flags, e.g. for User Presence (0x01) and/or User Verification (0x04)
        if ((authenticatorData[32] & authenticatorFlags) != authenticatorFlags) {
            return false;
        }

        bytes32 message = signingMessage(authenticatorData, challenge, clientDataFields);
        result = FCL_ecdsa_utils.ecdsa_verify(message, rs, qx, qy);
    }
}
