import { useCallback, useState } from 'react';
import { usePrivy, useConnectWallet, useWallets } from '@privy-io/react-auth';
import { midnightService } from '@/services/midnightService';
import toast from 'react-hot-toast';

export const useMidnight = () => {
  const { ready, login, logout } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { wallets, ready: walletsReady } = useWallets();
  const [isConnecting, setIsConnecting] = useState(false);

  const primary = wallets[0];
  const address = primary?.address ?? null;
  const isConnected = ready && walletsReady && !!primary;

  const connect = useCallback(async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      // Open Privy wallet connect modal
      await connectWallet({ walletChainType: 'ethereum-only' });
      // Ensure session
      await login?.();

      // Initialize ethers with Privy's EIP-1193 provider
      const eip1193 = (primary as any)?.provider ?? (wallets[0] as any)?.provider;
      if (eip1193) {
        await midnightService.connect(eip1193);
      }
      toast.success('Wallet connected');
    } catch (err) {
      console.error('Privy connect failed', err);
      toast.error('Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [connectWallet, login, primary, wallets, isConnecting]);

  const disconnect = useCallback(async () => {
    try {
      await logout?.();
    } finally {
      await midnightService.disconnect();
      toast.success('Wallet disconnected');
    }
  }, [logout]);

  return {
    address,
    isConnecting,
    isConnected,
    connect,
    disconnect,
  };
};