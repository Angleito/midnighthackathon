import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useMidnight } from '@/hooks/useMidnight';

export const WalletConnect: React.FC = () => {
  const { 
    address, 
    isConnecting, 
    isConnected, 
    totalBalance, 
    isSync, 
    connect, 
    disconnect, 
    formatAddress 
  } = useMidnight();
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      await connect();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      console.log(`Connected to Midnight wallet: ${address}`);
      console.log(`Balance: ${totalBalance}, Synced: ${isSync}`);
    }
  }, [isConnected, address, totalBalance, isSync]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="wallet-connect"
    >
      {!isConnected ? (
        <button
          onClick={handleConnect}
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
          <button onClick={disconnect} className="disconnect-btn">
            Disconnect
          </button>
        </div>
      )}
    </motion.div>
  );
};