import React from 'react';
import { motion } from 'framer-motion';

interface WalletInfo {
  name: string;
  description: string;
  url: string;
  icon: string;
  status: 'available' | 'coming-soon' | 'beta';
}

const supportedWallets: WalletInfo[] = [
  {
    name: 'NuFi Wallet',
    description: 'Multi-chain, browser-based wallet with powerful dApp support',
    url: 'https://wallet.nu.fi/',
    icon: '🔥',
    status: 'coming-soon'
  },
  {
    name: 'Vespr Wallet',
    description: 'Sleek mobile wallet for NFTs, staking, and Cardano-native tokens',
    url: 'https://vespr.xyz/',
    icon: '🌟',
    status: 'coming-soon'
  },
  {
    name: 'Gero Wallet',
    description: 'Feature-rich desktop wallet with DAO voting and cashback',
    url: 'https://gerowallet.io/',
    icon: '⚡',
    status: 'coming-soon'
  },
  {
    name: 'Yoroi Wallet',
    description: 'Lightweight legacy wallet by EMURGO with browser extension',
    url: 'https://yoroi-wallet.com/',
    icon: '🗾',
    status: 'coming-soon'
  },
  {
    name: 'Begin Wallet',
    description: 'Clean UI with Cardano + BTC dual support and staking tools',
    url: 'https://begin.is/',
    icon: '🚀',
    status: 'coming-soon'
  }
];

interface WalletInstallGuideProps {
  onClose: () => void;
  onTryDevelopmentMode: () => void;
}

export const WalletInstallGuide: React.FC<WalletInstallGuideProps> = ({ 
  onClose, 
  onTryDevelopmentMode 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="wallet-install-guide"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
    >
      <motion.div
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 50 }}
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '80vh',
          overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: 'white', fontSize: '1.5em' }}>
            🌙 Midnight Wallet Required
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>

        <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '20px', lineHeight: 1.6 }}>
          To interact with the Midnight Network, you'll need a compatible wallet. 
          Several wallets are preparing to support Midnight Network and the $NIGHT token.
        </p>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ color: 'white', fontSize: '1.2em', marginBottom: '16px' }}>
            Supported Wallets (Coming Soon)
          </h3>
          
          <div style={{ display: 'grid', gap: '12px' }}>
            {supportedWallets.map((wallet) => (
              <div
                key={wallet.name}
                style={{
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <span style={{ fontSize: '24px' }}>{wallet.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontWeight: 'bold', marginBottom: '4px' }}>
                    {wallet.name}
                    <span style={{
                      marginLeft: '8px',
                      fontSize: '0.7em',
                      padding: '2px 6px',
                      background: wallet.status === 'available' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(249, 115, 22, 0.2)',
                      color: wallet.status === 'available' ? '#22c55e' : '#f97316',
                      borderRadius: '4px'
                    }}>
                      {wallet.status === 'available' ? 'Available' : 'Coming Soon'}
                    </span>
                  </div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9em' }}>
                    {wallet.description}
                  </div>
                </div>
                <a
                  href={wallet.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '6px 12px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    color: 'white',
                    textDecoration: 'none',
                    fontSize: '0.8em'
                  }}
                >
                  Visit
                </a>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          padding: '16px',
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          marginBottom: '20px'
        }}>
          <h4 style={{ color: '#60a5fa', margin: '0 0 8px 0' }}>
            💡 Development Mode Available
          </h4>
          <p style={{ color: 'rgba(255, 255, 255, 0.8)', margin: '0 0 12px 0', fontSize: '0.9em' }}>
            For testing and development, you can use a temporary wallet that connects directly to the Midnight testnet.
          </p>
          <button
            onClick={onTryDevelopmentMode}
            style={{
              padding: '8px 16px',
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.5)',
              borderRadius: '6px',
              color: '#60a5fa',
              cursor: 'pointer',
              fontSize: '0.9em'
            }}
          >
            Try Development Mode
          </button>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.8em',
          color: 'rgba(255, 255, 255, 0.6)'
        }}>
          <span>Learn more about Midnight Network</span>
          <a
            href="https://midnight.network"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#60a5fa',
              textDecoration: 'none'
            }}
          >
            midnight.network →
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
};