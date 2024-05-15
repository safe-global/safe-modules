import { Outlet } from 'react-router-dom'
import { useWeb3ModalAccount, useWeb3ModalProvider } from '@web3modal/ethers/react'
import safeLogo from '/safe-logo.svg'
import ConnectButton from '../components/ConnectButton.tsx'
import { ConnectWallet } from '../components/ConnectWallet.tsx'
import { APP_CHAIN_ID } from '../config.ts'
import { SwitchNetwork } from '../components/SwitchNetwork.tsx'

function Root() {
  const { walletProvider } = useWeb3ModalProvider()
  const { chainId } = useWeb3ModalAccount()

  let content = <>{walletProvider && <Outlet context={{ walletProvider }} />}</>
  if (!walletProvider) {
    content = <ConnectWallet />
  } else if (chainId !== APP_CHAIN_ID) {
    content = <SwitchNetwork walletProvider={walletProvider} />
  }

  return (
    <>
      <header className="header">
        <a href="https://safe.global" target="_blank">
          <img src={safeLogo} className="logo" alt="Safe logo" />
        </a>

        <div className="card">
          <ConnectButton />
        </div>
      </header>
      <h1>4337 + Passkeys demo</h1>

      {content}
    </>
  )
}

export { Root }
