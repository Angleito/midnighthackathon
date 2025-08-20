import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMidnight } from '@/hooks/useMidnight';
import { WalletErrorBoundary } from '@/components/ErrorBoundary';
import { midnightWalletService, type WalletOption } from '@/services/midnightWalletService';
import { WalletInstallGuide } from './WalletInstallGuide';

export const WalletConnect: React.FC = () => {
  const { 
    address, 
    isConnecting, 
    isConnected, 
    totalBalance, 
    isSync, 
    connect, 
    disconnect, 
    formatAddress,
    walletState 
  } = useMidnight();
  const [loading, setLoading] = useState(false);
  const [showWalletOptions, setShowWalletOptions] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [availableWallets, setAvailableWallets] = useState<WalletOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (walletId?: string) => {
    setLoading(true);
    setError(null);
    try {
      await connect(walletId);
      setShowWalletOptions(false);
    } catch (error) {
      console.error('Connection failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  const detectWallets = async () => {
    try {
      console.log('Detecting Midnight wallets...');
      const wallets = await midnightWalletService.getAvailableWallets();
      setAvailableWallets(wallets);
      
      if (wallets.length > 0) {
        console.log(`Found ${wallets.length} Midnight wallet(s):`, wallets.map(w => w.name));
      } else {
        console.warn('No Midnight wallets detected. Make sure Lace Midnight Preview is installed.');
      }
      
      return wallets;
    } catch (error) {
      console.error('Failed to detect wallets:', error);
      setError('Failed to detect wallet extensions. Please make sure Lace Midnight Preview is installed.');
      return [];
    }
  };

  const handleShowWalletOptions = async () => {
    const wallets = await detectWallets();
    if (wallets.length === 0) {
      // No extension wallets found, show install guide
      setShowInstallGuide(true);
    } else if (wallets.length === 1) {
      // Only one wallet, connect directly
      await handleConnect(wallets[0].id);
    } else {
      // Multiple wallets, show options
      setShowWalletOptions(true);
    }
  };

  const handleTryDevelopmentMode = async () => {
    setShowInstallGuide(false);
    await handleConnect(); // This will use programmatic mode
  };

  useEffect(() => {
    if (isConnected) {
      // Only log connection details in development mode
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        console.log(`Connected to Midnight wallet: ${address}`);
        console.log(`Balance: ${totalBalance}, Synced: ${isSync}, Mode: ${walletState.walletMode}`);
      }
    }
  }, [isConnected, address, totalBalance, isSync, walletState.walletMode]);

  useEffect(() => {
    // Detect wallets on component mount
    detectWallets();
  }, []);

  return (
    <WalletErrorBoundary>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="wallet-connect"
      >
        {!isConnected ? (
          <div className="wallet-connection">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="error-message"
                style={{ 
                  color: '#ff6b6b', 
                  fontSize: '0.9em', 
                  marginBottom: '8px',
                  padding: '8px',
                  background: 'rgba(255, 107, 107, 0.1)',
                  borderRadius: '4px',
                  border: '1px solid rgba(255, 107, 107, 0.3)'
                }}
              >
                {error}
              </motion.div>
            )}
            
            <button
              onClick={handleShowWalletOptions}
              disabled={isConnecting || loading}
              className="connect-btn"
            >
              {isConnecting || loading ? (
                <span className="loading">Connecting to Midnight...</span>
              ) : (
                <>
                  <span className="wallet-icon">🌙</span>
                  Connect Midnight Wallet
                </>
              )}
            </button>

            {/* Development mode bypass button */}
            {availableWallets.length === 0 && !isConnecting && !loading && (
              <button
                onClick={() => handleConnect()}
                className="connect-btn"
                style={{
                  marginTop: '8px',
                  background: 'rgba(100, 150, 255, 0.2)',
                  border: '1px solid rgba(100, 150, 255, 0.5)',
                  fontSize: '0.9em'
                }}
              >
                <span className="wallet-icon">⚡</span>
                Use Development Mode
              </button>
            )}

            <AnimatePresence>
              {showWalletOptions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="wallet-options"
                  style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div style={{ fontSize: '0.9em', marginBottom: '8px', opacity: 0.8 }}>
                    Choose a wallet:
                  </div>
                  
                  {availableWallets.map((wallet) => (
                    <button
                      key={wallet.id}
                      onClick={() => handleConnect(wallet.id)}
                      disabled={loading}
                      className="wallet-option-btn"
                      style={{
                        display: 'block',
                        width: '100%',
                        margin: '4px 0',
                        padding: '8px 12px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '4px',
                        color: 'inherit',
                        cursor: 'pointer',
                        fontSize: '0.9em'
                      }}
                    >
                      {wallet.icon && <span style={{ marginRight: '8px' }}>{wallet.icon}</span>}
                      {wallet.name}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => setShowWalletOptions(false)}
                    className="cancel-btn"
                    style={{
                      marginTop: '8px',
                      padding: '4px 8px',
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '4px',
                      color: 'inherit',
                      cursor: 'pointer',
                      fontSize: '0.8em',
                      opacity: 0.7
                    }}
                  >
                    Cancel
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {availableWallets.length === 0 && !isConnecting && !loading && (
              <div style={{ 
                marginTop: '12px', 
                fontSize: '0.8em', 
                opacity: 0.8,
                textAlign: 'center',
                background: 'rgba(255, 165, 0, 0.1)',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid rgba(255, 165, 0, 0.3)'
              }}>
                <div style={{ marginBottom: '4px' }}>⚠️ Lace Midnight Preview not detected</div>
                <div style={{ fontSize: '0.7em', opacity: 0.7 }}>
                  Check extension permissions → "On all sites"
                </div>
              </div>
            )}
            
            {walletState.walletMode !== 'extension' && isConnected && (
              <div style={{ 
                marginTop: '8px', 
                fontSize: '0.8em', 
                opacity: 0.6,
                textAlign: 'center'
              }}>
                Using {walletState.walletMode} wallet mode
              </div>
            )}
          </div>
        ) : (
          <div className="wallet-info" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="address">
              <span className="wallet-icon">🌙</span>
              {formatAddress(address!)}
            </div>
            {totalBalance > 0n && (
              <div className="balance" style={{ fontSize: '0.9em', opacity: 0.8 }}>
                {(Number(totalBalance) / 1e18).toFixed(4)} NIGHT
              </div>
            )}
            <div className="sync-status" style={{ fontSize: '0.8em', padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
              {isSync ? '🟢 Synced' : '🟡 Syncing'}
            </div>
            <div className="wallet-mode" style={{ fontSize: '0.7em', padding: '1px 4px', background: 'rgba(100,150,255,0.2)', borderRadius: '3px' }}>
              {walletState.walletMode}
            </div>
            <button onClick={disconnect} className="disconnect-btn">
              Disconnect
            </button>
          </div>
        )}

        <AnimatePresence>
          {showInstallGuide && (
            <WalletInstallGuide
              onClose={() => setShowInstallGuide(false)}
              onTryDevelopmentMode={handleTryDevelopmentMode}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </WalletErrorBoundary>
  );
};