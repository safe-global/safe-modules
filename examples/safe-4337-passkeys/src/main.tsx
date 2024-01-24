import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
// Keep the import of the wallets file to eval so w3m package can initialise
// the required globals
import './logic/wallets.ts'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
