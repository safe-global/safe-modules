// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title P256Wrapper contract
 * @dev A contract that implements P256 wrapper with mallability check.
 *      As recommended in https://eips.ethereum.org/EIPS/eip-7212
 *      Follows precompile interface.
 *      The contract is not used in the current implementation, it is kept for the sake of example.
 * @custom:acknowledgement The contract is heavily inspired by https://github.com/daimo-eth/p256-verifier
 */
contract P256Wrapper {
    address public immutable VERIFIER;

    constructor(address verifier) {
        require(verifier != address(0), "P256: invalid verifier address");
        VERIFIER = verifier;
    }

    /// P256 curve order n/2 for malleability check
    uint256 internal constant _P256_N_DIV_2 = 57896044605178124381348723474703786764998477612067880171211129530534256022184;

    /**
     * @dev Verifies the signature of a message using P256 elliptic curve.
     * @param message The signed message.
     * @param r The r component of the signature.
     * @param s The s component of the signature.
     * @param x The x coordinate of the public key.
     * @param y The y coordinate of the public key.
     * @return success A boolean indicating whether the signature is valid or not.
     */
    function verifySignatureAllowMalleability(
        bytes32 message,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) public view returns (bool success) {
        address verifier = VERIFIER;

        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            // Prepare input for staticcall
            let input := mload(0x40) // Free memory pointer
            mstore(input, message)
            mstore(add(input, 32), r)
            mstore(add(input, 64), s)
            mstore(add(input, 96), x)
            mstore(add(input, 128), y)

            // Perform staticcall
            success := staticcall(gas(), verifier, input, 160, 0, 32)

            // Check for success and return value
            switch success
            case 0 {
                revert(0, 0)
            }
            case 1 {
                success := mload(0)
                return(0, 32)
            }
        }
    }

    /**
     * @dev Verifies the signature of a message using the P256 elliptic curve.
     * @param message The signed message.
     * @param r The r component of the signature.
     * @param s The s component of the signature.
     * @param x The x coordinate of the public key.
     * @param y The y coordinate of the public key.
     * @return success A boolean indicating whether the signature is valid or not.
     */
    function verifySignature(bytes32 message, uint256 r, uint256 s, uint256 x, uint256 y) internal view returns (bool success) {
        // check for signature malleability
        if (s > _P256_N_DIV_2) {
            return false;
        }

        success = verifySignatureAllowMalleability(message, r, s, x, y);
    }
}
