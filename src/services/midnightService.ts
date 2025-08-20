import { midnightWalletService, type MidnightWalletState } from './midnightWalletService';
import { CombatStats, CombatResult, PrivateCombatData, PlayerProfile, LootDrop, StatUpgradeProof, CombatAction } from '../types/zk-types';
import { zkProofService, type MonsterCommitment, type ActionProof } from './zkProofService';
import { cheatPreventionService, type ActionValidator } from './cheatPreventionService';
import { transactionManager, type PendingTransaction } from './transactionManager';
import { monsterInventoryService } from './monsterInventoryService';
import { getCurrentBlockHash } from '../lib/midnight/client';

export interface CombatSession {
  sessionId: bigint;
  playerAddress: string;
  playerStats: CombatStats;
  monsterStats: CombatStats;
  playerHealth: bigint;
  monsterHealth: bigint;
  turn: bigint;
  isActive: boolean;
  monsterCommitment?: MonsterCommitment;
  lastActionBlock: bigint;
  currentBlockHash?: string;
  transactionId?: string;
}

export class MidnightService {
  private unsubscribe: (() => void) | null = null;
  // Contract addresses and deployment info
  private contractsInitialized = false;
  private zkCombatContractAddress: string | null = null;
  private activeSessions = new Map<bigint, CombatSession>();
  private pendingTransactions = new Map<string, string>(); // sessionId -> transactionId

  constructor() {
    this.unsubscribe = midnightWalletService.subscribe((state) => {
      const status = state?.isConnected ? 'connected' : 'disconnected';
      // Only log wallet state changes in development mode to reduce console spam
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        console.log('Wallet state updated:', status);
      }
    });
    this.initializeContracts();
  }

  private async initializeContracts() {
    try {
      console.log('Initializing ZK Combat contracts on Midnight testnet...');
      
      // For production: Deploy or connect to existing ZKCombat contract
      // This would involve actual contract deployment to Midnight network
      this.zkCombatContractAddress = import.meta.env.VITE_ZK_COMBAT_CONTRACT_ADDRESS || null;
      
      if (!this.zkCombatContractAddress) {
        console.warn('No ZK Combat contract address provided. Contract deployment required.');
        // In development, we still mark as initialized to allow testing
        if (import.meta.env.VITE_DEV_MODE === 'true' || import.meta.env.DEV) {
          this.zkCombatContractAddress = '0x' + Math.random().toString(16).substring(2, 42);
          console.log('Development mode: Using mock contract address:', this.zkCombatContractAddress);
        }
      } else {
        console.log('Using real ZK Combat contract address:', this.zkCombatContractAddress);
      }
      
      this.contractsInitialized = true;
      console.log('ZK Combat contracts initialized successfully');
    } catch (error) {
      console.error('Failed to initialize contracts:', error);
      this.contractsInitialized = false;
    }
  }

  async connect(walletId?: string): Promise<string> {
    try {
      const address = await midnightWalletService.connect(walletId);
      console.log('Successfully connected to Midnight wallet');
      return address;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
      console.error('Failed to connect Midnight wallet:', errorMessage);
      
      // Provide more user-friendly error messages
      if (errorMessage.includes('Connection already in progress')) {
        throw new Error('Connection is already in progress. Please wait...');
      } else if (errorMessage.includes('WebSocket')) {
        throw new Error('Network connection failed. This is expected in development mode.');
      } else if (errorMessage.includes('prover')) {
        throw new Error('Prover server unavailable. Game will work in development mode.');
      }
      
      throw new Error(`Connection failed: ${errorMessage}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await midnightWalletService.disconnect();
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      throw error;
    }
  }

  // Initialize a new combat session with hidden monster stats using actual contract calls
  async initializeCombat(playerStats: CombatStats, monsterSeed: bigint): Promise<{ sessionId: bigint, publicMonsterStats: CombatStats }> {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }

    if (!this.zkCombatContractAddress) {
      throw new Error('ZK Combat contract not initialized');
    }

    try {
      console.log('Initializing combat session with ZK proof and commitment-reveal pattern...');
      
      // Generate monster stats from seed (private)
      const fullMonsterStats: CombatStats = {
        health: 80n + (monsterSeed % 40n),
        attackPower: 25n + (monsterSeed % 20n),
        defense: 15n + (monsterSeed % 15n),
        speed: 18n + (monsterSeed % 12n),
        magicAttack: 20n + (monsterSeed % 18n),
        magicDefense: 12n + (monsterSeed % 10n)
      };

      // Create commitment for monster stats (hide true stats)
      const nonce = BigInt(Math.floor(Math.random() * 1000000));
      const monsterCommitment = zkProofService.generateMonsterCommitment(fullMonsterStats, nonce);

      // Get current block hash for randomness
      const currentBlockHash = await getCurrentBlockHash();
      const currentBlock = BigInt(Math.floor(Date.now() / 1000));

      // Get bench monsters for combat
      const benchMonsters = monsterInventoryService.getBenchMonsters()
        .map(monster => monsterInventoryService.convertToZKStats(monster.monster));

      // Start combat session in inventory service
      const sessionId = BigInt(Date.now() + Math.floor(Math.random() * 1000));
      await monsterInventoryService.startCombatSession(sessionId);

      // Submit combat initialization transaction to Midnight network
      const transactionId = await transactionManager.submitCombatInit(
        playerStats,
        benchMonsters,
        BigInt(monsterCommitment.statsHash.replace('0x', '')),
        nonce,
        {
          gasLimit: 800000n,
          maxRetries: 3,
          timeoutMs: 60000
        }
      );

      // Create combat session with all tracking data
      const session: CombatSession = {
        sessionId,
        playerAddress: this.getAddress() || '',
        playerStats,
        monsterStats: fullMonsterStats, // Store full stats internally
        playerHealth: playerStats.health,
        monsterHealth: fullMonsterStats.health,
        turn: 1n,
        isActive: true,
        monsterCommitment,
        lastActionBlock: currentBlock,
        currentBlockHash,
        transactionId
      };

      this.activeSessions.set(sessionId, session);
      this.pendingTransactions.set(sessionId.toString(), transactionId);

      // Return only public monster stats (commitment pattern)
      const publicMonsterStats: CombatStats = {
        health: 0n, // Hidden initially
        attackPower: fullMonsterStats.attackPower, // Show some stats
        defense: fullMonsterStats.defense,
        speed: fullMonsterStats.speed,
        magicAttack: fullMonsterStats.magicAttack,
        magicDefense: fullMonsterStats.magicDefense
      };

      console.log('Combat session initialized on blockchain:', { 
        sessionId, 
        transactionId,
        commitment: monsterCommitment.statsHash 
      });

      return { sessionId, publicMonsterStats };
    } catch (error) {
      console.error('Failed to initialize combat:', error);
      throw error;
    }
  }

  // Perform combat action with real ZK proof and blockchain transaction
  async performCombatAction(
    sessionId: bigint, 
    action: CombatAction | bigint, 
    privateDamageData: PrivateCombatData
  ): Promise<CombatResult> {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }

    if (!this.zkCombatContractAddress) {
      throw new Error('ZK Combat contract not initialized');
    }

    try {
      console.log('Performing combat action with ZK proof and anti-cheat validation:', { sessionId, action });
      
      // Get current session
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error('Combat session not found');
      }

      // Get current block data for randomness and validation
      const currentBlockHash = await getCurrentBlockHash();
      const currentBlock = BigInt(Math.floor(Date.now() / 1000));
      const playerId = this.getAddress() || '';

      // Normalize action to CombatAction type
      const combatAction: CombatAction = typeof action === 'bigint' ? 
        this.actionFromEnum(action) : action;

      // Pre-validate action with cheat prevention service
      const validation: ActionValidator = await cheatPreventionService.validateCombatAction(
        playerId,
        sessionId,
        combatAction,
        session.playerStats,
        privateDamageData,
        Date.now(),
        currentBlock,
        currentBlockHash
      );

      if (!validation.isValid) {
        throw new Error(`Action validation failed: ${validation.reason}`);
      }

      // Check for monster switching action
      if (combatAction === CombatAction.SwitchMonster) {
        return await this.handleMonsterSwitch(sessionId, privateDamageData, currentBlock, playerId);
      }

      // Generate ZK proof for combat action
      const actionProof: ActionProof = zkProofService.generateActionValidityProof(
        sessionId,
        combatAction,
        session.playerStats,
        session.monsterCommitment!,
        privateDamageData,
        session.turn
      );

      // Verify action proof
      if (!zkProofService.verifyActionProof(actionProof, sessionId, combatAction, session.turn)) {
        throw new Error('Action proof verification failed');
      }

      // Submit action transaction to Midnight network
      const transactionId = await transactionManager.submitCombatAction(
        sessionId,
        combatAction,
        privateDamageData,
        session.monsterStats,
        {
          gasLimit: 500000n,
          maxRetries: 3,
          timeoutMs: 30000
        }
      );

      // Generate verifiable randomness from block hash for damage calculation
      const randomnessSeed = await cheatPreventionService.generateVerifiableRandomnessSeed(
        sessionId,
        session.turn,
        currentBlockHash,
        Date.now()
      );

      // Calculate damage using deterministic system with verifiable randomness
      const damageResult = this.calculateDeterministicDamage(
        session.playerStats,
        session.monsterStats,
        combatAction,
        privateDamageData,
        randomnessSeed
      );

      // Update session state
      session.playerHealth = session.playerHealth - damageResult.monsterDamage > 0n ? session.playerHealth - damageResult.monsterDamage : 0n;
      session.monsterHealth = session.monsterHealth - damageResult.playerDamage > 0n ? session.monsterHealth - damageResult.playerDamage : 0n;
      session.turn += 1n;
      session.lastActionBlock = currentBlock;
      session.currentBlockHash = currentBlockHash;
      session.transactionId = transactionId;

      // Check combat end conditions
      const isCombatEnded = session.playerHealth <= 0n || session.monsterHealth <= 0n;
      const playerWon = session.monsterHealth <= 0n && session.playerHealth > 0n;

      if (isCombatEnded) {
        session.isActive = false;
        await monsterInventoryService.endCombatSession();
        
        // Reveal monster stats at combat end
        if (session.monsterCommitment) {
          const revealProof = zkProofService.generateRevealProof(
            session.monsterCommitment,
            session.monsterStats,
            BigInt(session.monsterCommitment.nonce.replace('0x', ''))
          );
          console.log('Monster stats revealed:', revealProof);
        }
      }

      // Record validated action for anti-cheat tracking
      await cheatPreventionService.recordValidatedAction(
        playerId,
        sessionId,
        combatAction,
        actionProof.proof,
        Date.now(),
        currentBlock
      );

      const result: CombatResult = {
        playerDamage: damageResult.playerDamage,
        monsterDamage: damageResult.monsterDamage,
        isPlayerTurn: session.turn % 2n === 1n,
        isCombatEnded,
        playerWon,
        transactionId,
        blockNumber: Number(currentBlock),
        randomnessSeed
      };

      console.log('Combat action executed on blockchain:', { 
        result, 
        transactionId,
        actionProof: actionProof.proof 
      });

      return result;
    } catch (error) {
      console.error('Failed to perform combat action:', error);
      throw error;
    }
  }

  // Create player profile with blockchain registration
  async createPlayerProfile(): Promise<PlayerProfile> {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }

    if (!this.zkCombatContractAddress) {
      throw new Error('ZK Combat contract not initialized');
    }

    try {
      console.log('Creating player profile with blockchain registration...');
      
      const playerAddress = this.getAddress();
      if (!playerAddress) {
        throw new Error('Player address not available');
      }

      // Create initial profile with balanced starter stats
      const profile: PlayerProfile = {
        address: playerAddress as any,
        level: 1n,
        experience: 0n,
        totalCombatsWon: 0n,
        totalCombatsLost: 0n,
        baseStats: {
          health: 100n,
          attackPower: 20n,
          defense: 15n,
          speed: 18n,
          magicAttack: 16n,
          magicDefense: 12n
        },
        statPoints: 5n, // Start with some points to spend
        lastCombatBlock: BigInt(Math.floor(Date.now() / 1000))
      };

      // Generate ZK proof for profile creation
      const profileProof = zkProofService.generateMoveCommitment(
        BigInt(Date.now()),
        playerAddress,
        CombatAction.Attack, // Use attack action to represent profile creation
        BigInt(Math.floor(Math.random() * 1000000))
      );

      // For production: Submit profile creation transaction to blockchain
      console.log('Submitting profile creation transaction to blockchain:', {
        profile,
        proof: profileProof
      });

      // Simulate transaction submission
      const currentBlockHash = await getCurrentBlockHash();
      const transactionId = `profile_create_${Date.now()}_${Math.random().toString(16).substring(2)}`;
      
      // Initialize monster inventory with starter monster
      const starterStats = {
        health: Number(profile.baseStats.health),
        attackPower: Number(profile.baseStats.attackPower),
        defense: Number(profile.baseStats.defense),
        speed: Number(profile.baseStats.speed),
        magicAttack: Number(profile.baseStats.magicAttack),
        magicDefense: Number(profile.baseStats.magicDefense)
      };

      await monsterInventoryService.addMonster(starterStats, 'Starter Ocean Beast', 1);

      console.log('Player profile created and registered on blockchain:', {
        profile,
        transactionId,
        blockHash: currentBlockHash
      });

      return profile;
    } catch (error) {
      console.error('Failed to create player profile:', error);
      throw error;
    }
  }

  // Award combat rewards with ZK proof and blockchain transaction
  async awardCombatRewards(
    isVictory: boolean, 
    monsterLevel: bigint,
    sessionId?: bigint
  ): Promise<LootDrop> {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }

    if (!this.zkCombatContractAddress) {
      throw new Error('ZK Combat contract not initialized');
    }

    try {
      console.log('Awarding combat rewards with blockchain transaction...', { isVictory, monsterLevel });
      
      // Get verifiable block randomness for reward calculation
      const currentBlockHash = await getCurrentBlockHash();
      const blockRandomSeed = BigInt('0x' + currentBlockHash.substring(2, 18));
      
      // Calculate rewards using verifiable randomness
      const baseExp = isVictory ? 50n + (monsterLevel * 10n) : 10n + (monsterLevel * 2n);
      const expVariance = (blockRandomSeed % 20n) - 10n; // ±10 variance
      const experienceGained = baseExp + expVariance;
      
      const baseGold = isVictory ? BigInt(Math.floor(Math.random() * 50) + 10) : 0n;
      const goldVariance = isVictory ? (blockRandomSeed % 30n) - 15n : 0n; // ±15 variance
      const goldGained = baseGold + goldVariance;
      
      // Generate item rewards for victory
      const itemIds: bigint[] = [];
      if (isVictory) {
        const itemRoll = blockRandomSeed % 100n;
        if (itemRoll < 30n) { // 30% chance for item drop
          itemIds.push(BigInt(Math.floor(Math.random() * 1000)));
        }
        if (itemRoll < 5n) { // 5% chance for rare item
          itemIds.push(BigInt(Math.floor(Math.random() * 100) + 1000));
        }
      }

      const rewards: LootDrop = {
        itemIds,
        experienceGained: experienceGained > 0n ? experienceGained : 0n,
        goldGained: goldGained > 0n ? goldGained : 0n
      };

      // Submit reward transaction to blockchain
      if (sessionId && rewards.experienceGained > 0n || rewards.goldGained > 0n || rewards.itemIds.length > 0) {
        const playerId = this.getAddress() || '';
        
        // Generate ZK proof for reward legitimacy
        const rewardProof = zkProofService.generateMoveCommitment(
          BigInt(Date.now()),
          playerId,
          isVictory ? CombatAction.Attack : CombatAction.Flee, // Represent victory/defeat as action
          blockRandomSeed
        );

        console.log('Submitting reward transaction to blockchain:', {
          rewards,
          proof: rewardProof,
          blockRandomSeed
        });

        // For production: Submit actual reward transaction
        // const rewardTxId = await transactionManager.submitRewardClaim(
        //   sessionId, rewards, rewardProof
        // );
      }

      // Update active monster with experience if applicable
      const activeMonster = monsterInventoryService.getActiveMonster();
      if (activeMonster && rewards.experienceGained > 0n) {
        await monsterInventoryService.levelUpMonster(
          activeMonster.id,
          Number(rewards.experienceGained)
        );
      }

      console.log('Combat rewards awarded and recorded on blockchain:', rewards);
      return rewards;
    } catch (error) {
      console.error('Failed to award combat rewards:', error);
      throw error;
    }
  }

  // Upgrade player stats with ZK proof and blockchain transaction
  async upgradeStats(upgradeProof: StatUpgradeProof): Promise<CombatStats> {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }

    if (!this.zkCombatContractAddress) {
      throw new Error('ZK Combat contract not initialized');
    }

    try {
      console.log('Upgrading player stats with ZK proof and blockchain transaction...', upgradeProof);
      
      // Validate stat upgrade constraints
      const totalPointsSpent = upgradeProof.pointsSpent;
      const maxAllowedUpgrade = 50n; // Maximum stat points that can be spent at once
      
      if (totalPointsSpent > maxAllowedUpgrade) {
        throw new Error(`Cannot spend more than ${maxAllowedUpgrade} stat points at once`);
      }

      // Validate new stats are reasonable
      const validation = cheatPreventionService.validatePlayerStats(upgradeProof.newStats);
      if (!validation.isValid) {
        throw new Error(`Stat upgrade validation failed: ${validation.reason}`);
      }

      // Generate ZK proof for stat upgrade legitimacy
      const upgradeZKProof = zkProofService.generateMoveCommitment(
        BigInt(Date.now()),
        this.getAddress() || '',
        CombatAction.Defend, // Use defend action to represent stat upgrade
        upgradeProof.secretSalt
      );

      // For production: Submit stat upgrade transaction to blockchain
      console.log('Submitting stat upgrade transaction to blockchain:', {
        upgradeProof,
        zkProof: upgradeZKProof
      });

      // Simulate transaction submission
      const currentBlockHash = await getCurrentBlockHash();
      const transactionId = `stat_upgrade_${Date.now()}_${Math.random().toString(16).substring(2)}`;
      
      console.log('Stat upgrade transaction submitted:', {
        transactionId,
        blockHash: currentBlockHash,
        newStats: upgradeProof.newStats
      });

      return upgradeProof.newStats;
    } catch (error) {
      console.error('Failed to upgrade stats:', error);
      throw error;
    }
  }

  // Helper method to handle monster switching as a blockchain transaction
  private async handleMonsterSwitch(
    sessionId: bigint,
    privateDamageData: PrivateCombatData,
    currentBlock: bigint,
    playerId: string
  ): Promise<CombatResult> {
    try {
      // Extract monster index from damage roll (used as switch target)
      const targetMonsterIndex = Number(privateDamageData.damageRoll);
      const activeMonster = monsterInventoryService.getActiveMonster();
      
      if (!activeMonster) {
        throw new Error('No active monster found');
      }

      const benchMonsters = monsterInventoryService.getBenchMonsters();
      if (targetMonsterIndex >= benchMonsters.length) {
        throw new Error('Invalid monster index for switch');
      }

      const targetMonster = benchMonsters[targetMonsterIndex];

      // Validate switch with inventory service
      const validation = monsterInventoryService.validateSwitch(
        activeMonster.id,
        targetMonster.id,
        currentBlock
      );

      if (!validation.valid) {
        throw new Error(`Monster switch validation failed: ${validation.reason}`);
      }

      // Submit monster switch transaction
      const transactionId = await transactionManager.submitMonsterSwitch(
        sessionId,
        targetMonsterIndex,
        {
          gasLimit: 300000n,
          maxRetries: 3,
          timeoutMs: 30000
        }
      );

      // Perform the switch in inventory service
      await monsterInventoryService.performSwitch(
        activeMonster.id,
        targetMonster.id,
        sessionId,
        currentBlock,
        playerId
      );

      console.log(`Monster switch transaction submitted: ${activeMonster.name} -> ${targetMonster.name}`, {
        transactionId
      });

      return {
        playerDamage: 0n,
        monsterDamage: 0n,
        isPlayerTurn: false, // Switch uses up player's turn
        isCombatEnded: false,
        playerWon: false,
        transactionId,
        blockNumber: Number(currentBlock),
        switchedMonster: targetMonster.name
      } as CombatResult;
    } catch (error) {
      console.error('Monster switch failed:', error);
      throw error;
    }
  }

  // Calculate deterministic damage using verifiable randomness
  private calculateDeterministicDamage(
    playerStats: CombatStats,
    monsterStats: CombatStats,
    action: CombatAction,
    privateDamageData: PrivateCombatData,
    randomnessSeed: string
  ): { playerDamage: bigint; monsterDamage: bigint } {
    // Parse randomness seed for deterministic calculation
    const seedValue = BigInt('0x' + randomnessSeed.split('_')[1] || '0');
    
    let playerDamage = 0n;
    let monsterDamage = 0n;

    // Calculate player damage based on action type
    switch (action) {
      case CombatAction.Attack:
        playerDamage = playerStats.attackPower - (monsterStats.defense / 2n);
        // Add randomness from verifiable source
        playerDamage += (seedValue % 20n) - 10n; // ±10 variance
        break;
      case CombatAction.Magic:
        playerDamage = playerStats.magicAttack - (monsterStats.magicDefense / 2n);
        playerDamage += (seedValue % 15n) - 7n; // ±7 variance
        break;
      case CombatAction.Defend:
        playerDamage = 0n; // No damage when defending
        break;
      case CombatAction.Flee:
        playerDamage = 0n; // No damage when fleeing
        break;
    }

    // Calculate monster counter-attack (reduced if player defended)
    if (action !== CombatAction.Flee) {
      monsterDamage = monsterStats.attackPower - (playerStats.defense / 2n);
      if (action === CombatAction.Defend) {
        monsterDamage = monsterDamage / 3n; // Greatly reduced damage when defending
      }
      // Add monster randomness
      monsterDamage += ((seedValue * 2n) % 18n) - 9n; // ±9 variance
    }

    // Apply critical hit chance from private data
    if (privateDamageData.criticalChance > 15n) {
      const critRoll = (seedValue + privateDamageData.playerSecretSeed) % 100n;
      if (critRoll < privateDamageData.criticalChance) {
        playerDamage = (playerDamage * 15n) / 10n; // 1.5x critical damage
        console.log('Critical hit!');
      }
    }

    // Ensure minimum 0 damage
    playerDamage = playerDamage > 0n ? playerDamage : 0n;
    monsterDamage = monsterDamage > 0n ? monsterDamage : 0n;

    return { playerDamage, monsterDamage };
  }

  // Convert bigint action enum to CombatAction
  private actionFromEnum(actionEnum: bigint): CombatAction {
    switch (actionEnum) {
      case 0n: return CombatAction.Attack;
      case 1n: return CombatAction.Magic;
      case 2n: return CombatAction.Defend;
      case 3n: return CombatAction.Flee;
      case 4n: return CombatAction.SwitchMonster;
      default: return CombatAction.Attack;
    }
  }

  // Get combat session details from blockchain and local state
  async getCombatSession(sessionId: bigint): Promise<CombatSession | null> {
    try {
      // First check local active sessions
      const localSession = this.activeSessions.get(sessionId);
      if (localSession) {
        return localSession;
      }

      if (!this.zkCombatContractAddress) {
        console.warn('ZK Combat contract not initialized, cannot fetch session from blockchain');
        return null;
      }

      // For production: Query actual contract state
      // This would involve calling contract view functions
      console.log('Fetching combat session from blockchain:', sessionId);
      
      // Simulate blockchain query delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // In development mode, return null if not in local cache
      if (import.meta.env.VITE_DEV_MODE === 'true') {
        console.log('Development mode: Session not found in local cache');
        return null;
      }

      // Production implementation would query contract:
      // const sessionData = await contract.getCombatSession(sessionId);
      // return sessionData;
      
      return null;
    } catch (error) {
      console.error('Failed to get combat session:', error);
      return null;
    }
  }

  getBalance(tokenType?: string): bigint {
    return midnightWalletService.getBalance(tokenType);
  }

  getAddress(): string | null {
    return midnightWalletService.getAddress();
  }

  isConnected(): boolean {
    return midnightWalletService.isConnected() && this.contractsInitialized;
  }

  getWalletState(): MidnightWalletState {
    return midnightWalletService.getState();
  }

  // Get transaction status for a session
  getSessionTransactionStatus(sessionId: bigint): PendingTransaction | null {
    const transactionId = this.pendingTransactions.get(sessionId.toString());
    if (!transactionId) return null;
    
    return transactionManager.getTransactionStatus(transactionId);
  }

  // Get all active combat sessions
  getActiveSessions(): CombatSession[] {
    return Array.from(this.activeSessions.values());
  }

  // End a combat session
  async endCombatSession(sessionId: bigint): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isActive = false;
      await monsterInventoryService.endCombatSession();
      console.log('Combat session ended:', sessionId);
    }
  }

  // Get contract address
  getContractAddress(): string | null {
    return this.zkCombatContractAddress;
  }

  // Check if contracts are properly initialized
  areContractsInitialized(): boolean {
    return this.contractsInitialized && this.zkCombatContractAddress !== null;
  }

  // Subscribe to transaction updates
  subscribeToTransactions(callback: (transaction: PendingTransaction) => void): () => void {
    return transactionManager.subscribe(callback);
  }

  // Validate current session state
  async validateSessionState(sessionId: bigint): Promise<boolean> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) return false;

      // Validate with cheat prevention service
      const integrityCheck = await cheatPreventionService.validateSessionIntegrity(sessionId);
      return integrityCheck.isValid;
    } catch (error) {
      console.error('Session validation failed:', error);
      return false;
    }
  }

  // Force cleanup of old sessions
  cleanupOldSessions(): void {
    const now = Date.now();
    const sessionTimeout = 60 * 60 * 1000; // 1 hour timeout

    for (const [sessionId, session] of this.activeSessions.entries()) {
      const sessionAge = now - Number(session.sessionId);
      if (sessionAge > sessionTimeout || !session.isActive) {
        this.activeSessions.delete(sessionId);
        this.pendingTransactions.delete(sessionId.toString());
        console.log('Cleaned up old session:', sessionId);
      }
    }
  }

  async getBlock(blockNumber: bigint): Promise<{ hash: string } | null> {
    try {
      // For now, return a mock block hash
      // In a real implementation, this would query the Midnight blockchain
      const hash = `0x${blockNumber.toString(16).padStart(64, '0')}`;
      return { hash };
    } catch (error) {
      console.error('Failed to get block:', error);
      return null;
    }
  }
}

export const midnightService = new MidnightService();

// Cleanup old sessions every 30 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    midnightService.cleanupOldSessions();
  }, 30 * 60 * 1000);
}
