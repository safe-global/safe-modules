import { APP_CHAIN_SHORTNAME } from '../config.ts'

function getSafeWalletAppSafeDashboardLink(safeAddress: string, chainShortName = APP_CHAIN_SHORTNAME): string {
  return `https://app.safe.global/home?safe=${chainShortName}:${safeAddress}`
}

export { getSafeWalletAppSafeDashboardLink }
