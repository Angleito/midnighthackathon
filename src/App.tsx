import { Toaster } from 'react-hot-toast';
import { WalletConnect } from '@/components/Wallet/WalletConnect';
import CombatArena from '@/components/Combat/CombatArena';
import { useMidnight } from '@/hooks/useMidnight';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { midnightService } from '@/services/midnightService';

function App() {
  const { isConnected } = useMidnight();
  const [combatStarted, setCombatStarted] = useState(false);
  
  const startZKCombat = async () => {
    try {
      const address = midnightService.getAddress();
      if (!address) {
        console.error('No wallet address available');
        return;
      }
      
      setCombatStarted(true);
      console.log('🎮 Starting ZK Ocean Combat with blockchain transactions...');
      console.log('Player address:', address);
    } catch (error) {
      console.error('Failed to start ZK combat:', error);
    }
  };

  return (
    <div className="app">
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            fontFamily: 'Orbitron, monospace',
          },
        }}
      />
      
      <WalletConnect />
      
      <header className="app-header">
        <motion.h1 
          className="app-title"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          ZK Ocean Combat
        </motion.h1>
        <motion.p 
          className="app-subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Every turn creates a Midnight network transaction with ZK privacy
        </motion.p>
      </header>

      {!isConnected ? (
        <div className="connect-prompt">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            style={{ 
              textAlign: 'center', 
              padding: '60px 20px',
              color: 'var(--text-secondary)'
            }}
          >
            <h2 style={{ marginBottom: '20px', color: 'var(--ocean-light)' }}>
              ⚔️ Welcome to ZK Ocean Combat ⚔️
            </h2>
            <p>Connect your Midnight wallet to begin blockchain-based combat</p>
            <p style={{ fontSize: '14px', marginTop: '10px', opacity: 0.8 }}>
              Each action creates a real transaction with zero-knowledge privacy
            </p>
          </motion.div>
        </div>
      ) : (
        <main className="game-container">
          {!combatStarted ? (
            <div style={{ textAlign: 'center', marginTop: 40 }}>
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6 }}
              >
                <h2 style={{ marginBottom: '20px', color: 'var(--ocean-light)' }}>
                  🌊 Ready for Combat? 🌊
                </h2>
                <p style={{ marginBottom: '30px', color: 'var(--text-secondary)' }}>
                  Experience the first turn-based game where every action creates a blockchain transaction
                </p>
                <button 
                  className="start-battle-btn"
                  onClick={startZKCombat}
                  style={{
                    padding: '16px 32px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, var(--ocean-primary), var(--ocean-secondary))',
                    border: 'none',
                    borderRadius: '12px',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 15px rgba(0, 150, 255, 0.3)'
                  }}
                >
                  Start ZK Ocean Combat
                </button>
                <div style={{ marginTop: '20px', fontSize: '14px', opacity: 0.7 }}>
                  <p>✨ Monster switching counts as turns</p>
                  <p>🔐 Enemy stats hidden via ZK commitments</p>
                  <p>⛓️ Every action recorded on Midnight blockchain</p>
                </div>
              </motion.div>
            </div>
          ) : (
            <CombatArena />
          )}
        </main>
      )}
    </div>
  );
}

export default App;