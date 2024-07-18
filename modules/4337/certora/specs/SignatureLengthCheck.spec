using Account as safeContract;

methods {
    function checkSignaturesLength(bytes, uint256) external returns(bool) envfree;

    // Safe Contract functions
    function safeContract.canonicalSignature(bytes, uint256) external returns(bytes) envfree;
}

// This rule verifies that if excess data is added to the signature, though it could pass in the safe contract's `checkSignatures(...)`,
// it will be caught within the `_checkSignaturesLength(...)` call, as the dynamic length is checked.
rule signatureCannotBeLongerThanCanonicalEncoding(bytes signatures, uint256 threshold) {
    bytes canonical = safeContract.canonicalSignature(signatures, threshold);
    assert checkSignaturesLength(signatures, threshold) => signatures.length <= canonical.length;
}
