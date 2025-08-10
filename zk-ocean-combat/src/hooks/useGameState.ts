import { create } from 'zustand';
import { BattleState, BattlePhase, Monster, MonsterName, Move } from '@/types/game.types';
import { midnightService } from '@/services/midnightService';

// --- Monster presets ---
const createMove = (id: string, name: string, kind: 'attack' | 'status' | 'heal', power?: number, effect?: Move['effect']): Move => ({ id, name, kind, power, effect: effect || 'none' });

const NIGHT: Monster = {
  id: 'night',
  name: 'NIGHT',
  maxHP: 100,
  attack: 60,
  defense: 60,
  speed: 60,
  moves: [
    createMove('m1', 'Zero Knowledge Strike', 'attack', 30),
    createMove('m2', 'Midnight Shield', 'status', undefined, 'shield'),
    createMove('m3', 'Proof Verification', 'status', undefined, 'boost'),
    createMove('m4', 'Homomorphic Heal', 'heal', 25)
  ]
};

const DUST: Monster = {
  id: 'dust',
  name: 'DUST',
  maxHP: 110,
  attack: 45,
  defense: 75,
  speed: 55,
  moves: [
    createMove('m1', 'Commitment Bind', 'status', undefined, 'bind'),
    createMove('m2', 'Nullifier Blast', 'attack', 25, 'nullify'),
    createMove('m3', 'Midnight Shield', 'status', undefined, 'shield'),
    createMove('m4', 'Proof Verification', 'status', undefined, 'boost')
  ]
};

const ADA: Monster = {
  id: 'ada',
  name: 'ADA',
  maxHP: 140,
  attack: 85,
  defense: 80,
  speed: 80,
  moves: [
    createMove('m1', 'Cardano Consensus', 'status', undefined, 'boost'),
    createMove('m2', 'Recursive Proof', 'attack', 40),
    createMove('m3', 'Zero Knowledge Strike', 'attack', 35),
    createMove('m4', 'Homomorphic Heal', 'heal', 35)
  ]
};

const ENEMIES: Monster[] = [
  { id: 'snark', name: 'SNARK' as MonsterName, maxHP: 90, attack: 55, defense: 40, speed: 90, moves: [
    createMove('m1', 'Zero Knowledge Strike', 'attack', 25),
    createMove('m2', 'Nullifier Blast', 'attack', 20),
    createMove('m3', 'Proof Verification', 'status', undefined, 'boost'),
    createMove('m4', 'Midnight Shield', 'status', undefined, 'shield')
  ]},
  { id: 'stark', name: 'STARK' as MonsterName, maxHP: 130, attack: 50, defense: 90, speed: 40, moves: [
    createMove('m1', 'Midnight Shield', 'status', undefined, 'shield'),
    createMove('m2', 'Proof Verification', 'status', undefined, 'boost'),
    createMove('m3', 'Zero Knowledge Strike', 'attack', 20),
    createMove('m4', 'Commitment Bind', 'status', undefined, 'bind')
  ]},
  { id: 'bulletproof', name: 'Bulletproof' as MonsterName, maxHP: 100, attack: 60, defense: 60, speed: 60, moves: [
    createMove('m1', 'Zero Knowledge Strike', 'attack', 28),
    createMove('m2', 'Proof Verification', 'status', undefined, 'boost'),
    createMove('m3', 'Midnight Shield', 'status', undefined, 'shield'),
    createMove('m4', 'Homomorphic Heal', 'heal', 20)
  ]},
  { id: 'groth16', name: 'Groth16' as MonsterName, maxHP: 95, attack: 85, defense: 45, speed: 70, moves: [
    createMove('m1', 'Zero Knowledge Strike', 'attack', 38),
    createMove('m2', 'Recursive Proof', 'attack', 35),
    createMove('m3', 'Nullifier Blast', 'attack', 25),
    createMove('m4', 'Proof Verification', 'status', undefined, 'boost')
  ]},
  { id: 'plonk', name: 'PLONK' as MonsterName, maxHP: 100, attack: 55, defense: 55, speed: 65, moves: [
    createMove('m1', 'Commitment Bind', 'status', undefined, 'bind'),
    createMove('m2', 'Proof Verification', 'status', undefined, 'boost'),
    createMove('m3', 'Zero Knowledge Strike', 'attack', 26),
    createMove('m4', 'Homomorphic Heal', 'heal', 22)
  ]},
  { id: 'marlin', name: 'Marlin' as MonsterName, maxHP: 85, attack: 50, defense: 40, speed: 100, moves: [
    createMove('m1', 'Zero Knowledge Strike', 'attack', 24),
    createMove('m2', 'Nullifier Blast', 'attack', 22),
    createMove('m3', 'Proof Verification', 'status', undefined, 'boost'),
    createMove('m4', 'Midnight Shield', 'status', undefined, 'shield')
  ]}
];

// --- Helper functions ---
const calcDamage = (attacker: Monster, defender: Monster, move: Move): number => {
  if (move.kind === 'heal') return 0;
  const power = move.power || 20;
  const base = Math.max(1, attacker.attack + power - defender.defense);
  const variance = 0.85 + Math.random() * 0.3; // 0.85 - 1.15
  return Math.floor(base * variance);
};

const clone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

interface GameStore extends BattleState {
  // Player selects a move for current active monster; we do commit-reveal
  commitPlayerMove: (moveId: string) => Promise<void>;
  // Resolve turn when both sides have committed (enemy random for demo)
  resolveTurn: () => Promise<void>;
  // Switch player monster (if fainted or by choice)
  switchPlayerMonster: (index: number) => void;
  resetGame: () => void;
  startBattle: () => Promise<void>;
}

export const useGameState = create<GameStore>((set, get) => ({
  phase: 'init',
  turn: 0,
  playerTeam: [clone(NIGHT), clone(DUST), clone(ADA)],
  enemyTeam: ENEMIES.map(e => clone(e)),
  activePlayerIndex: 0,
  activeEnemyIndex: 0,
  winner: undefined,
  playerCommitment: null,
  enemyCommitment: null,
  lastLog: [],
  isResolving: false,

  startBattle: async () => {
    // Simulate committing hidden stats
    const commitment = await midnightService.commitBoardState('player-team-commitment');
    set({ phase: 'battle', playerCommitment: commitment, turn: 1 });
  },

  commitPlayerMove: async (moveId: string) => {
    const state = get();
    if (state.phase !== 'battle' || state.isResolving) return;

    // Build a simple commitment string for the selected move
    const commitStr = `${state.turn}:${state.activePlayerIndex}:${moveId}`;
    const commitment = btoa(commitStr).slice(0, 64);

    // Placeholder: submit commitment (conceal move)
    await midnightService.commitBoardState(commitment);

    set({ playerCommitment: commitment });
  },

  resolveTurn: async () => {
    const state = get();
    if (state.phase !== 'battle' || state.isResolving) return;
    if (!state.playerCommitment) return; // Need player's committed move

    set({ isResolving: true });

    const player = clone(state.playerTeam[state.activePlayerIndex]);
    const enemy = clone(state.enemyTeam[state.activeEnemyIndex]);

    // Reveal player's move (demo: decode from commitment – not secure)
    const decoded = atob(state.playerCommitment);
    const moveId = decoded.split(':')[2];
    const playerMove = player.moves.find(m => m.id === moveId) || player.moves[0];

    // Enemy chooses randomly and "commits"
    const enemyMove = enemy.moves[Math.floor(Math.random() * enemy.moves.length)];
    const enemyCommit = btoa(`${state.turn}:${state.activeEnemyIndex}:${enemyMove.id}`).slice(0, 64);
    set({ enemyCommitment: enemyCommit });

    // Placeholder ZK verification
    await midnightService.verifyProof('0xproof', [playerMove.name, enemyMove.name]);

    const logs: string[] = [];

    let playerHP = player.maxHP;
    let enemyHP = enemy.maxHP;

    // Apply moves: simple speed tiebreaker
    const first = player.speed >= enemy.speed ? 'player' : 'enemy';

    const applyMove = (actor: 'player' | 'enemy') => {
      if (actor === 'player') {
        if (playerMove.kind === 'heal') {
          const heal = playerMove.power || 20;
          playerHP = Math.min(player.maxHP, playerHP + heal);
          logs.push(`${player.name} used ${playerMove.name} and healed ${heal} HP.`);
        } else {
          const dmg = calcDamage(player, enemy, playerMove);
          enemyHP = Math.max(0, enemyHP - dmg);
          logs.push(`${player.name} used ${playerMove.name} and dealt ${dmg} damage.`);
        }
      } else {
        if (enemyMove.kind === 'heal') {
          const heal = enemyMove.power || 20;
          enemyHP = Math.min(enemy.maxHP, enemyHP + heal);
          logs.push(`${enemy.name} used ${enemyMove.name} and healed ${heal} HP.`);
        } else {
          const dmg = calcDamage(enemy, player, enemyMove);
          playerHP = Math.max(0, playerHP - dmg);
          logs.push(`${enemy.name} used ${enemyMove.name} and dealt ${dmg} damage.`);
        }
      }
    };

    if (first === 'player') { applyMove('player'); if (enemyHP > 0) applyMove('enemy'); }
    else { applyMove('enemy'); if (playerHP > 0) applyMove('player'); }

    const playerFainted = playerHP <= 0;
    const enemyFainted = enemyHP <= 0;

    // Update state monsters' HP (store as reduced maxHP for demo simplicity)
    const updatedPlayerTeam = state.playerTeam.map((m, i) => i === state.activePlayerIndex ? { ...m, maxHP: playerHP } : m);
    const updatedEnemyTeam = state.enemyTeam.map((m, i) => i === state.activeEnemyIndex ? { ...m, maxHP: enemyHP } : m);

    let activePlayerIndex = state.activePlayerIndex;
    let activeEnemyIndex = state.activeEnemyIndex;
    let winner: BattleState['winner'] = undefined;

    if (enemyFainted) {
      logs.push(`${enemy.name} fainted!`);
      activeEnemyIndex += 1;
      if (activeEnemyIndex >= state.enemyTeam.length) {
        winner = 'player';
      }
    }

    if (playerFainted) {
      logs.push(`${player.name} fainted!`);
      // Auto-switch to next available
      const nextIdx = updatedPlayerTeam.findIndex((m, idx) => idx !== activePlayerIndex && m.maxHP > 0);
      if (nextIdx !== -1) {
        activePlayerIndex = nextIdx;
      } else {
        winner = 'enemy';
      }
    }

    const nextPhase: BattlePhase = winner ? 'finished' : 'battle';

    set({
      playerTeam: updatedPlayerTeam,
      enemyTeam: updatedEnemyTeam,
      activePlayerIndex,
      activeEnemyIndex,
      lastLog: [...state.lastLog, ...logs],
      playerCommitment: null,
      enemyCommitment: null,
      isResolving: false,
      turn: state.turn + 1,
      phase: nextPhase,
      winner
    });
  },

  switchPlayerMonster: (index: number) => {
    const state = get();
    if (index < 0 || index >= state.playerTeam.length) return;
    if (state.playerTeam[index].maxHP <= 0) return; // can't switch to fainted
    set({ activePlayerIndex: index });
  },

  resetGame: () => {
    set({
      phase: 'init',
      turn: 0,
      playerTeam: [clone(NIGHT), clone(DUST), clone(ADA)],
      enemyTeam: ENEMIES.map(e => clone(e)),
      activePlayerIndex: 0,
      activeEnemyIndex: 0,
      winner: undefined,
      playerCommitment: null,
      enemyCommitment: null,
      lastLog: [],
      isResolving: false
    });
  }
}));
