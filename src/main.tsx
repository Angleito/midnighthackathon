import React from 'react'
import ReactDOM from 'react-dom/client'
// import SimpleApp from './SimpleApp'
import App from './App'
import './styles/globals.css'

// Simple app wrapper without external providers
const AppWithProviders = () => {
  return <App />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWithProviders />
  </React.StrictMode>,
)