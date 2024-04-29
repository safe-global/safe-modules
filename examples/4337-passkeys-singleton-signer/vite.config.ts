import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import commonjs from 'vite-plugin-commonjs'

const REQUIRED_ENV_VARS = ['VITE_WC_CLOUD_PROJECT_ID', 'VITE_WC_4337_BUNDLER_URL']

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())

  for (const key of REQUIRED_ENV_VARS) {
    if (!env[key]) {
      throw new Error(`Environment variable ${key} is missing`)
    }
  }

  return {
    plugins: [react(), commonjs()],
  }
})
