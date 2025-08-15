import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

// Extend window for Midnight wallet detection
declare global {
  interface Window {
    midnight?: any;
    ethereum?: Record<string, unknown>;
  }
}

// Simple app wrapper without external providers
const AppWithProviders = () => {
  return <App />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWithProviders />
  </React.StrictMode>,
)