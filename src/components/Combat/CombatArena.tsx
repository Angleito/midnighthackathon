import React, { useState, useEffect } from 'react';
import PlayerStats from './PlayerStats';
import MonsterCard from './MonsterCard';
import ActionButtons from './ActionButtons';
import MonsterRoster from './MonsterRoster';
import MonsterSwitchModal from './MonsterSwitchModal';
import { useCombat } from '../../hooks/useCombat';
import { useMonsterSwitching } from '../../hooks/useMonsterSwitching';
import { useMidnight } from '../../hooks/useMidnight';
import { midnightService } from '../../services/midnightService';
import { CombatAction } from '../../types/combat.d';
import { MonsterSlot } from '../../services/monsterInventoryService';

const CombatArena: React.FC = () => {
    const { isConnected } = useMidnight();
    
    // Get the actual wallet address for the player
    const playerAddress = isConnected ? midnightService.getAddress() || 'player1' : 'player1';
    
    const { 
        playerStats, 
        monsterStats, 
        handleAction, 
        isCombatActive,
        sessionId 
    } = useCombat(playerAddress, 'sea-serpent');

    const {
        activeMonster,
        benchMonsters,
        switchesUsed,
        maxSwitches,
        switchCooldown,
        isTransactionPending,
        error: switchError,
        performSwitch,
        updateMonsterHealth,
        checkAutoSwitch,
        clearError,
        canSwitch
    } = useMonsterSwitching(sessionId, playerAddress);

    const [showSwitchModal, setShowSwitchModal] = useState(false);
    const [showRoster, setShowRoster] = useState(false);

    // Include 'switch' in combat actions
    const combatActions = ['attack', 'magic', 'defend', 'switch', 'flee'] as const;

    // Handle combat actions including monster switching
    const handleCombatAction = async (action: CombatAction) => {
        if (action === 'switch') {
            setShowSwitchModal(true);
            return;
        }
        
        try {
            await handleAction(action);
            
            // Check if active monster fainted and auto-switch is needed
            if (activeMonster && activeMonster.health <= 0) {
                await checkAutoSwitch();
            }
        } catch (error) {
            console.error('Combat action failed:', error);
        }
    };

    // Handle monster switch from modal
    const handleMonsterSwitch = async (targetMonster: MonsterSlot) => {
        try {
            await performSwitch(targetMonster);
            setShowSwitchModal(false);
        } catch (error) {
            console.error('Monster switch failed:', error);
            // Error is handled by the hook and displayed in UI
        }
    };

    // Handle quick switch from roster
    const handleQuickSwitch = async (targetMonster: MonsterSlot) => {
        if (!canSwitch(targetMonster)) {
            return;
        }
        
        try {
            await performSwitch(targetMonster);
        } catch (error) {
            console.error('Quick switch failed:', error);
        }
    };

    // Sync monster health with combat system
    useEffect(() => {
        if (playerStats && activeMonster && playerStats.health !== activeMonster.health) {
            updateMonsterHealth(activeMonster.id, playerStats.health);
        }
    }, [playerStats?.health, activeMonster?.id, updateMonsterHealth]);

    // Determine if switch action should be disabled
    const isSwitchDisabled = !isCombatActive || 
                            isTransactionPending || 
                            switchesUsed >= maxSwitches || 
                            switchCooldown > 0 ||
                            benchMonsters.filter(m => m.health > 0).length === 0;

    return (
        <div className="combat-arena max-w-7xl mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">Combat Arena</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowRoster(!showRoster)}
                        className={`
                            px-4 py-2 rounded-md font-medium transition-colors
                            ${showRoster 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }
                        `}
                    >
                        {showRoster ? 'Hide Roster' : 'Show Roster'}
                    </button>
                </div>
            </div>

            {/* Error Display */}
            {switchError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center text-red-800">
                            <span className="font-medium">Switch Error:</span>
                            <span className="ml-2">{switchError}</span>
                        </div>
                        <button
                            onClick={clearError}
                            className="text-red-600 hover:text-red-800"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Left Column - Player Stats & Actions */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white border border-gray-300 rounded-lg p-4">
                        <h3 className="text-lg font-bold mb-3 text-gray-800">Player</h3>
                        <PlayerStats stats={playerStats} />
                    </div>
                    
                    <div className="bg-white border border-gray-300 rounded-lg p-4">
                        <h3 className="text-lg font-bold mb-3 text-gray-800">Actions</h3>
                        <ActionButtons 
                            actions={combatActions} 
                            onAction={handleCombatAction}
                            disabled={!isCombatActive}
                            switchDisabled={isSwitchDisabled}
                        />
                        
                        {/* Switch Status Info */}
                        {(switchCooldown > 0 || switchesUsed >= maxSwitches) && (
                            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                                {switchCooldown > 0 && (
                                    <p className="text-yellow-800">
                                        Switch cooldown: {switchCooldown} blocks
                                    </p>
                                )}
                                {switchesUsed >= maxSwitches && (
                                    <p className="text-yellow-800">
                                        Max switches used ({switchesUsed}/{maxSwitches})
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Center Column - Monster Card */}
                <div className="lg:col-span-2">
                    <div className="bg-white border border-gray-300 rounded-lg p-6">
                        <h3 className="text-lg font-bold mb-4 text-gray-800 text-center">
                            Enemy Monster
                        </h3>
                        <MonsterCard monster={monsterStats} />
                        
                        {/* Combat Status */}
                        <div className="mt-4 text-center">
                            {!isCombatActive && (
                                <p className="text-red-600 font-medium">Combat Ended</p>
                            )}
                            {isTransactionPending && (
                                <div className="flex items-center justify-center text-blue-600">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                    <span>Processing transaction...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column - Monster Roster */}
                <div className="lg:col-span-1">
                    {showRoster ? (
                        <MonsterRoster
                            activeMonster={activeMonster}
                            benchMonsters={benchMonsters}
                            switchesUsed={switchesUsed}
                            maxSwitches={maxSwitches}
                            switchCooldown={switchCooldown}
                            onSwitchClick={handleQuickSwitch}
                            isTransactionPending={isTransactionPending}
                        />
                    ) : (
                        <div className="bg-white border border-gray-300 rounded-lg p-4">
                            <h3 className="text-lg font-bold mb-3 text-gray-800">Active Monster</h3>
                            {activeMonster ? (
                                <div className="space-y-3">
                                    <div className="text-center">
                                        <h4 className="font-bold text-blue-900">{activeMonster.name}</h4>
                                        <p className="text-sm text-gray-600">Level {activeMonster.level}</p>
                                    </div>
                                    
                                    {/* Health Bar */}
                                    <div>
                                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                                            <span>HP</span>
                                            <span>{activeMonster.health}/{activeMonster.maxHealth}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-3">
                                            <div
                                                className={`h-3 rounded-full transition-all duration-300 ${
                                                    activeMonster.health > activeMonster.maxHealth * 0.7 ? 'bg-green-500' :
                                                    activeMonster.health > activeMonster.maxHealth * 0.3 ? 'bg-yellow-500' :
                                                    'bg-red-500'
                                                }`}
                                                style={{ 
                                                    width: `${Math.max(0, (activeMonster.health / activeMonster.maxHealth) * 100)}%` 
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Quick Stats */}
                                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                                        <div>ATK: {activeMonster.monster.attackPower}</div>
                                        <div>DEF: {activeMonster.monster.defense}</div>
                                        <div>SPD: {activeMonster.monster.speed}</div>
                                        <div>MAG: {activeMonster.monster.magicAttack}</div>
                                    </div>

                                    {/* Quick Switch Button */}
                                    <button
                                        onClick={() => setShowSwitchModal(true)}
                                        disabled={isSwitchDisabled}
                                        className={`
                                            w-full py-2 px-3 text-sm font-medium rounded transition-colors
                                            ${!isSwitchDisabled
                                                ? 'bg-blue-500 text-white hover:bg-blue-600'
                                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            }
                                        `}
                                    >
                                        Switch Monster
                                    </button>
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center">No active monster</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Monster Switch Modal */}
            <MonsterSwitchModal
                isOpen={showSwitchModal}
                onClose={() => setShowSwitchModal(false)}
                activeMonster={activeMonster}
                benchMonsters={benchMonsters}
                onConfirmSwitch={handleMonsterSwitch}
                switchesUsed={switchesUsed}
                maxSwitches={maxSwitches}
                switchCooldown={switchCooldown}
                isTransactionPending={isTransactionPending}
            />
        </div>
    );
};

export default CombatArena;