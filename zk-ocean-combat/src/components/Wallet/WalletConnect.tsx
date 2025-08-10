import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useMidnight } from '@/hooks/useMidnight';

export const WalletConnect: React.FC = () => {
  const { address, isConnecting, isConnected, connect, disconnect } = useMidnight();
  const [loading, setLoading] = useState(false);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleConnect = async () => {
    setLoading(true);
    await connect();
    setLoading(false);
  };

  useEffect(() => {
    if (isConnected) {
      console.log(`Connected to wallet: ${address}`);
    }
  }, [isConnected, address]);

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
            <span className="loading">Connecting...</span>
          ) : (
            <>
              <span className="wallet-icon">🔗</span>
              Connect Wallet
            </>
          )}
        </button>
      ) : (
        <div className="wallet-info" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="address">
            <span className="wallet-icon">⚓</span>
            {formatAddress(address!)}
          </div>
          <button onClick={disconnect} className="disconnect-btn">
            Disconnect
          </button>
        </div>
      )}
    </motion.div>
  );
};