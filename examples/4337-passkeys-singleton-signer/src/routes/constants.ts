const HOME_ROUTE = '/'
const CREATE_PASSKEY_ROUTE = '/create-passkey'
const DEPLOY_SAFE_ROUTE = '/deploy-safe'
const SAFE_ROUTE = '/safe/:safeAddress'

const getSafeRoute = (safeAddress: string) => `/safe/${safeAddress}`

export { HOME_ROUTE, CREATE_PASSKEY_ROUTE, DEPLOY_SAFE_ROUTE, SAFE_ROUTE, getSafeRoute }
