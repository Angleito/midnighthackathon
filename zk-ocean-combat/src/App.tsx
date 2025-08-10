import { Toaster } from 'react-hot-toast';
import { WalletConnect } from '@/components/Wallet/WalletConnect';
import { useGameState } from '@/hooks/useGameState';
import { useMidnight } from '@/hooks/useMidnight';
import { motion } from 'framer-motion';
import type { Monster } from '@/types/game.types';

function App() {
  const {
    phase,
    startBattle,
    playerTeam,
    enemyTeam,
    activePlayerIndex,
    activeEnemyIndex,
    playerCommitment,
    isResolving,
    commitPlayerMove,
    resolveTurn,
    switchPlayerMonster,
    lastLog,
    resetGame,
    winner
  } = useGameState();
  const { isConnected } = useMidnight();

  const activePlayer = playerTeam[activePlayerIndex];
  const activeEnemy = enemyTeam[activeEnemyIndex];

  const baseHP = (m: Monster) => {
    switch (m.name) {
      case 'NIGHT': return 100;
      case 'DUST': return 110;
      case 'ADA': return 140;
      case 'SNARK': return 90;
      case 'STARK': return 130;
      case 'Bulletproof': return 100;
      case 'Groth16': return 95;
      case 'PLONK': return 100;
      case 'Marlin': return 85;
      default: return m.maxHP;
    }
  };

  const hpPercent = (m?: Monster) => {
    if (!m) return 0;
    const base = baseHP(m) || 1;
    return Math.max(0, Math.min(100, Math.round((m.maxHP / base) * 100)));
  };

  const canResolve = phase === 'battle' && !!playerCommitment && !isResolving;

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
          ZK Monster Battle
        </motion.h1>
        <motion.p 
          className="app-subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Cryptographic creatures clash with zero-knowledge moves
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
              ⚔️ Welcome Challenger ⚔️
            </h2>
            <p>Connect your wallet to begin the ZK battles</p>
          </motion.div>
        </div>
      ) : (
        <main className="game-container" style={{ display: 'grid', gap: 20 }}>
          {phase === 'init' && (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button className="start-battle-btn" onClick={startBattle}>
                Start Battle
              </button>
            </div>
          )}

          {(phase === 'battle' || phase === 'finished') && (
            <>
              {/* Enemy progression indicators */}
              <div className="enemy-progress" style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                {enemyTeam.map((_, i) => {
                  const defeated = i < activeEnemyIndex;
                  const active = i === activeEnemyIndex && phase !== 'finished';
                  return (
                    <div key={i} title={`Enemy ${i + 1}`} style={{
                      width: 14,
                      height: 14,
                      borderRadius: '999px',
                      background: defeated ? '#4b5563' : active ? '#ef4444' : '#9ca3af',
                      opacity: defeated ? 0.5 : 1,
                      boxShadow: active ? '0 0 8px rgba(239,68,68,0.8)' : 'none'
                    }} />
                  );
                })}
              </div>

              {/* Active monsters */}
              <div className="battle-stage" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
                {/* Player card */}
                <div className="player-card" style={{ border: '1px solid var(--border-color)', padding: 16, borderRadius: 12 }}>
                  <h3 style={{ marginBottom: 8 }}>Player: {activePlayer?.name}</h3>
                  <div style={{ fontSize: 12, marginBottom: 6 }}>HP: {activePlayer?.maxHP}</div>
                  <div style={{ background: '#111827', borderRadius: 6, overflow: 'hidden', height: 10, marginBottom: 10 }}>
                    <div style={{ width: hpPercent(activePlayer) + '%', height: '100%', background: '#10b981', transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {activePlayer?.moves.map((mv) => (
                      <button
                        key={mv.id}
                        className="btn"
                        disabled={!!playerCommitment || isResolving || phase !== 'battle'}
                        onClick={() => commitPlayerMove(mv.id)}
                      >
                        {mv.name}
                      </button>
                    ))}
                  </div>

                  {/* Switch controls */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, marginBottom: 6 }}>Switch Monster</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {playerTeam.map((m, idx) => (
                        <button
                          key={m.id}
                          className="btn"
                          disabled={idx === activePlayerIndex || m.maxHP <= 0 || isResolving}
                          onClick={() => switchPlayerMonster(idx)}
                          title={m.name}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Enemy card */}
                <div className="enemy-card" style={{ border: '1px solid var(--border-color)', padding: 16, borderRadius: 12 }}>
                  <h3 style={{ marginBottom: 8 }}>Enemy: {activeEnemy?.name || '—'}</h3>
                  <div style={{ fontSize: 12, marginBottom: 6 }}>HP: {activeEnemy?.maxHP ?? 0}</div>
                  <div style={{ background: '#111827', borderRadius: 6, overflow: 'hidden', height: 10 }}>
                    <div style={{ width: hpPercent(activeEnemy) + '%', height: '100%', background: '#ef4444', transition: 'width 0.3s' }} />
                  </div>

                  {/* Resolve section */}
                  <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                    <button className="btn" disabled={!canResolve} onClick={resolveTurn}>
                      Resolve Turn
                    </button>
                    {phase === 'finished' && (
                      <button className="btn" onClick={resetGame}>Reset</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Logs */}
              <div className="battle-log" style={{ marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                <h4 style={{ marginBottom: 8 }}>Battle Log</h4>
                <ul style={{ listStyle: 'disc', paddingLeft: 18 }}>
                  {lastLog.map((l, i) => (
                    <li key={i} style={{ opacity: 0.9 }}>{l}</li>
                  ))}
                </ul>
                {phase === 'finished' && (
                  <div style={{ marginTop: 12, fontWeight: 600 }}>
                    {winner === 'player' ? 'Victory! All enemy ZK Monsters defeated.' : 'Defeat. Your team has fallen.'}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      )}
    </div>
  );
}

export default App;