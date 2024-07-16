using Account as safeContract;

methods {
    function checkSignaturesLength(bytes, uint256) external returns(bool) envfree;
    function combineBytes(bytes, bytes) external returns(bytes) envfree;

    // Safe Contract functions
    function safeContract.canonicalSignatureHash(bytes, uint256) external returns(bytes32) envfree;
}

// This rule verifies that if excess data is added to the signature, though it could pass in the safe contract's `checkSignatures(...)`,
// it will be caught within the `_checkSignaturesLength(...)` call, as the dynamic length is checked.
rule canonicalHashBasedLengthCheck(bytes signatures, bytes griefedSignatures, uint256 threshold) {
    require safeContract.canonicalSignatureHash(signatures, threshold) == safeContract.canonicalSignatureHash(griefedSignatures, threshold);
    require signatures.length < griefedSignatures.length;

    assert checkSignaturesLength(signatures, threshold) => !checkSignaturesLength(griefedSignatures, threshold);
}
