import { useOutletContext as useOutletContextRRD } from 'react-router'
import { ethers } from 'ethers'

type OutletContext = {
  walletProvider: ethers.Eip1193Provider
}

function useOutletContext() {
  return useOutletContextRRD<OutletContext>()
}

export { useOutletContext }
