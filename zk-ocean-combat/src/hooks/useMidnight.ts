import { useCallback, useState, useEffect } from 'react';
import { midnightWalletService, type MidnightWalletState } from '@/services/midnightWalletService';
import { midnightService } from '@/services/midnightService';
import toast from 'react-hot-toast';

export const useMidnight = () => {
  const [walletState, setWalletState] = useState<MidnightWalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    balances: {},
    isSync: false,
    totalBalance: 0n,
  });

  const { address, isConnected, isConnecting, balances, isSync, totalBalance } = walletState;

  useEffect(() => {
    const unsubscribe = midnightWalletService.subscribe((state) => {
      setWalletState(state);
    });

    setWalletState(midnightWalletService.getState());

    return unsubscribe;
  }, []);

  const connect = useCallback(async () => {
    if (isConnecting) return;
    
    try {
      await midnightService.connect();
      toast.success('Midnight wallet connected successfully');
    } catch (err) {
      console.error('Failed to connect Midnight wallet:', err);
      toast.error('Failed to connect Midnight wallet');
    }
  }, [isConnecting]);

  const disconnect = useCallback(async () => {
    try {
      await midnightService.disconnect();
      toast.success('Midnight wallet disconnected');
    } catch (err) {
      console.error('Failed to disconnect wallet:', err);
      toast.error('Failed to disconnect wallet');
    }
  }, []);

  const getBalance = useCallback((tokenType?: string) => {
    try {
      return midnightWalletService.getBalance(tokenType);
    } catch (err) {
      console.error('Failed to get balance:', err);
      return 0n;
    }
  }, []);

  const formatAddress = useCallback((addr: string) => {
    return midnightWalletService.formatAddress(addr);
  }, []);

  return {
    address,
    isConnecting,
    isConnected,
    balances,
    totalBalance,
    isSync,
    connect,
    disconnect,
    getBalance,
    formatAddress,
    walletState,
  };
};