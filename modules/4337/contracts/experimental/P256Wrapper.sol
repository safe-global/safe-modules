// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title P256Wrapper contract
 * @dev A contract that implements P256 wrapper with mallability check.
 *      As recommended in https://eips.ethereum.org/EIPS/eip-7212
 *      Follows precompile interface.
 * @custom:acknowledgement The contract is heavily inspired by https://github.com/daimo-eth/p256-verifier
 */
contract P256Wrapper {
    address immutable VERIFIER;

    constructor(address verifier) {
        require(verifier != address(0), "P256: invalid verifier address");
        VERIFIER = verifier;
    }

    /// P256 curve order n/2 for malleability check
    uint256 constant P256_N_DIV_2 = 57896044605178124381348723474703786764998477612067880171211129530534256022184;

    /**
     * @dev Verifies the signature of a message using P256 elliptic curve.
     * @param message_hash The hash of the message to be verified.
     * @param r The r component of the signature.
     * @param s The s component of the signature.
     * @param x The x coordinate of the public key.
     * @param y The y coordinate of the public key.
     * @return A boolean indicating whether the signature is valid or not.
     */
    function verifySignatureAllowMalleability(
        bytes32 message_hash,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) internal view returns (bool) {
        bytes memory args = abi.encode(message_hash, r, s, x, y);
        (bool success, bytes memory ret) = VERIFIER.staticcall(args);
        assert(success); // never reverts, always returns 0 or 1

        return abi.decode(ret, (uint256)) == 1;
    }

    /**
     * @dev Verifies the signature of a message using the P256 elliptic curve.
     * @param message_hash The hash of the message to be verified.
     * @param r The r component of the signature.
     * @param s The s component of the signature.
     * @param x The x coordinate of the public key.
     * @param y The y coordinate of the public key.
     * @return A boolean indicating whether the signature is valid.
     */
    function verifySignature(bytes32 message_hash, uint256 r, uint256 s, uint256 x, uint256 y) internal view returns (bool) {
        // check for signature malleability
        if (s > P256_N_DIV_2) {
            return false;
        }

        return verifySignatureAllowMalleability(message_hash, r, s, x, y);
    }
}