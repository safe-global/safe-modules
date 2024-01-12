# Audit Results

## Auditor

Ackee Blockchain (<https://ackeeblockchain.com/>).

## Notes

The final audit was performed on commit [25779b5a5077e109a585993a02c4dad2209ab084](https://github.com/safe-global/safe-modules/tree/25779b5a5077e109a585993a02c4dad2209ab084).

There is one acknowledged finding from the audit report:

- _W2: Usage of `solc` optimizer_
  > After careful consideration, we decided to enable the optimizer for the following reasons:
  >
  > - The most critical functionality, such as signature checks and replay protection, is handled by the Safe and Entrypoint contracts.
  > - The entrypoint contract uses the optimizer.

## Files

- [Final audit report](audit-report-v2.0.pdf)
