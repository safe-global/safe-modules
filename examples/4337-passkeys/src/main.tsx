import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

// Keep the import of the wallets file to eval so w3m package can initialise
// the required globals
import './logic/wallets.ts'
import './index.css'
import { Root } from './routes/Root.tsx'
import { Home, loader as homeLoader } from './routes/Home.tsx'
import { DeploySafe, loader as deploySafeLoader } from './routes/DeploySafe.tsx'
import { CreatePasskey } from './routes/CreatePasskey.tsx'
import { CREATE_PASSKEY, DEPLOY_SAFE, SAFE } from './routes/constants.ts'
import { Safe, loader as safeLoader } from './routes/Safe.tsx'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, loader: homeLoader, element: <Home /> },
      { path: CREATE_PASSKEY, element: <CreatePasskey /> },
      { path: DEPLOY_SAFE, loader: deploySafeLoader, element: <DeploySafe /> },
      { path: SAFE, loader: safeLoader, element: <Safe /> },
    ],
  },
])

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
