
import React, { useState } from 'react'
import { useSafe } from '@rmeissner/safe-apps-react-sdk';
import './App.css'

const App = () => {
  const safe = useSafe()
  return (<div>Safe Address: {safe.getSafeInfo().safeAddress}</div>)
}

export default App
