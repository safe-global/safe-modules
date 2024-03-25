# Audit Results

## Audit 1

### Auditor

Ackee Blockchain (<https://ackeeblockchain.com/>).

### Notes

The final audit was performed on commit [25779b5a5077e109a585993a02c4dad2209ab084](https://github.com/safe-global/safe-modules/tree/25779b5a5077e109a585993a02c4dad2209ab084).

There is one acknowledged finding from the audit report:

- _W2: Usage of `solc` optimizer_
  > After careful consideration, we decided to enable the optimizer for the following reasons:
  >
  > - The most critical functionality, such as signature checks and replay protection, is handled by the Safe and Entrypoint contracts.
  > - The entrypoint contract uses the optimizer.

### Files

- [Final audit report](audit-report-v2.0.pdf)

## Audit 2

### Auditor

OpenZeppelin (<https://openzeppelin.com/>).

### Notes

The final audit was performed on commit [3853f34f31837e0a0aee47a4452564278f8c62ba](https://github.com/safe-global/safe-modules/tree/3853f34f31837e0a0aee47a4452564278f8c62ba).

No issues were reported related to the module's business logic, but we have implemented some of the suggested optimisations from the audit report into the codebase. These changes will be included in the next release of the 4337 module. For more information about the audit findings, please refer to the report.

Changes from the audit were implemented in commit [c2bdf0059770916ad178a45c2ad6f2cb88f85ff7](https://github.com/safe-global/safe-modules/tree/c2bdf0059770916ad178a45c2ad6f2cb88f85ff7).

### Files

- [Final audit report](audit-report-openzeppelin.pdf)
