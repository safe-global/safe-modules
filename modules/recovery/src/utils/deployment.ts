export function getDeploymentParameters() {
  const RECOVERY_PERIOD = 14 * 24 * 60 * 60 // 14 days

  const { DEPLOYMENT_RECOVERY_PERIOD } = process.env

  return {
    recoveryPeriod: DEPLOYMENT_RECOVERY_PERIOD || RECOVERY_PERIOD,
  }
}
