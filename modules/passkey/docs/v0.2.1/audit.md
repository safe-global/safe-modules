# Audit Results

## Audit Competition

Hats Finance (<https://hats.finance/>).

### Notes

The audit competition was performed on commit [9a18245f546bf2a8ed9bdc2b04aae44f949ec7a0](https://github.com/safe-global/safe-modules/tree/9a18245f546bf2a8ed9bdc2b04aae44f949ec7a0).

There were three low severity findings that were found as part of the competition, with fixes acknowledged by the submitters:

- _L-01: Does not emit event after writing into storage_

  Fixed in <https://github.com/safe-global/safe-modules/pull/456>

- _L-02: low level staticcall return value is not checked_

  Fixed in <https://github.com/safe-global/safe-modules/pull/457>

- _L-03: Usage of floating pragma_

  Fixed in <https://github.com/safe-global/safe-modules/pull/458>

### Files

- [Final audit competition report](audit-competition-report-hats.md)

## Auditor

Certora (<https://www.certora.com/>).

### Notes

The final audit was performed on commit [c3a4d0671099c5e17fda7287b764b93f6b9801df](https://github.com/safe-global/safe-modules/tree/c3a4d0671099c5e17fda7287b764b93f6b9801df).

No new issues were discovered during this audit.

### Files

- [Final audit report](audit-report-certora.pdf)
