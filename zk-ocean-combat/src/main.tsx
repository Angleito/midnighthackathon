import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { PrivyProvider } from '@privy-io/react-auth'

// Extend window for Ethereum
declare global {
  interface Window {
    ethereum?: Record<string, unknown>;
  }
}

const appId = import.meta.env.VITE_PRIVY_APP_ID as string | undefined

// Conditionally render Privy provider only if app ID is provided
const AppWithProviders = () => {
  if (appId) {
    return (
      <PrivyProvider appId={appId}>
        <App />
      </PrivyProvider>
    );
  }
  
  return <App />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWithProviders />
  </React.StrictMode>,
)