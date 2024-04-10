const HOME = '/'
const CREATE_PASSKEY = '/create-passkey'
const DEPLOY_SAFE = '/deploy-safe'
const SAFE = '/safe/:safeAddress'

const getSafeRoute = (safeAddress: string) => `/safe/${safeAddress}`

export { HOME, CREATE_PASSKEY, DEPLOY_SAFE, SAFE, getSafeRoute }
