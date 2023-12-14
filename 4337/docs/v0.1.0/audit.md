**⚠️ This version contains known issues and should not be used. ⚠️**

# Audit Results

## Auditor

Ackee Blockchain (<https://ackeeblockchain.com/>).

## Notes

The final audit was performed on commit [1981fbc63e3850d626074d81d22a198afe64ac03](https://github.com/safe-global/safe-modules/tree/1981fbc63e3850d626074d81d22a198afe64ac03).

There are two acknowledged findings from the audit report:

- _W2: Usage of `solc` optimizer_
  > After careful consideration, we decided to enable the optimizer for the following reasons:
  >
  > - The most critical functionality, such as signature checks and replay protection, is handled by the Safe and Entrypoint contracts.
  > - The entrypoint contract uses the optimizer.
- _I4: Contract does not allow to specify `validAfter` and `validUntil` parameters_
  > We are choosing not to support this feature at the moment but may implement it in a follow-up revision of the module.

## Files

- [Final audit report](audit-report-v1.1.pdf)

## Known Issues

The contract does not include all the User Operation parameters in its signature mechanism. Notably, the two missing parameters are `initCode` and `paymasterAndData`. This allows a malicious actor to execute a Safe operation with different `initCode` (causing potentially additional gas fees to the user) or `paymasterAndData` (causing the user to pay for gas fees in Ether despite not expecting it) than what the user originally intended. See section _M1_ from the [v0.2.0 audit report](../v0.2.0/audit-report-v2.0.pdf).
