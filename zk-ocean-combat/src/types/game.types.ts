export type Coordinate = {
  x: number;
  y: number;
};

export type ShipType = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';

export interface Ship {
  id: string;
  type: ShipType;
  size: number;
  positions: Coordinate[];
  hits: Coordinate[];
  isPlaced: boolean;
  isSunk: boolean;
  orientation: 'horizontal' | 'vertical';
}

export interface GameCell {
  coordinate: Coordinate;
  isHit: boolean;
  isMiss: boolean;
  hasShip: boolean;
  shipId?: string;
}

export type GamePhase = 'setup' | 'placement' | 'battle' | 'finished';

export interface GameState {
  phase: GamePhase;
  currentPlayer: string;
  playerBoard: GameCell[][];
  opponentBoard: GameCell[][];
  playerShips: Ship[];
  turn: number;
  winner?: string;
}

// ZK Monster Battle types

export type MonsterName =
  | 'NIGHT'
  | 'DUST'
  | 'ADA'
  | 'SNARK'
  | 'STARK'
  | 'Bulletproof'
  | 'Groth16'
  | 'PLONK'
  | 'Marlin';

export type MoveKind = 'attack' | 'status' | 'heal';

export interface Move {
  id: string; // unique within monster
  name: string;
  kind: MoveKind;
  power?: number; // for attack moves
  // Simple status effects for demo
  effect?: 'shield' | 'bind' | 'nullify' | 'boost' | 'none';
}

export interface Monster {
  id: string;
  name: MonsterName;
  maxHP: number;
  attack: number;
  defense: number;
  speed: number;
  moves: Move[]; // 4 moves per monster
}

export type BattlePhase = 'init' | 'battle' | 'finished';

export interface BattleState {
  phase: BattlePhase;
  turn: number;
  playerTeam: Monster[];
  enemyTeam: Monster[];
  activePlayerIndex: number; // 0..playerTeam.length-1
  activeEnemyIndex: number; // progresses from 0..5
  winner?: 'player' | 'enemy';
  // ZK commitments: commit-reveal per turn
  playerCommitment: string | null;
  enemyCommitment: string | null;
  lastLog: string[];
  isResolving: boolean;
}

export interface ZKProof {
  proof: string;
  publicInputs: string[];
  commitment: string;
}

export interface TurnResolution {
  playerDamageDealt: number;
  enemyDamageDealt: number;
  playerFainted: boolean;
  enemyFainted: boolean;
}
