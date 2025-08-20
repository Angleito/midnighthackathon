import React, { useState } from 'react';
import { MonsterSlot } from '../../services/monsterInventoryService';

interface MonsterSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMonster: MonsterSlot | null;
  benchMonsters: MonsterSlot[];
  onConfirmSwitch: (targetMonster: MonsterSlot) => Promise<void>;
  switchesUsed: number;
  maxSwitches: number;
  switchCooldown: number;
  isTransactionPending?: boolean;
}

const MonsterSwitchModal: React.FC<MonsterSwitchModalProps> = ({
  isOpen,
  onClose,
  activeMonster,
  benchMonsters,
  onConfirmSwitch,
  switchesUsed,
  maxSwitches,
  switchCooldown,
  isTransactionPending = false
}) => {
  const [selectedMonster, setSelectedMonster] = useState<MonsterSlot | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isOpen) return null;

  const availableMonsters = benchMonsters.filter(monster => 
    monster.health > 0 && !monster.isActive
  );

  const canSwitch = switchesUsed < maxSwitches && switchCooldown === 0 && !isTransactionPending;

  const handleConfirmSwitch = async () => {
    if (!selectedMonster || !canSwitch) return;

    setIsConfirming(true);
    try {
      await onConfirmSwitch(selectedMonster);
      onClose();
    } catch (error) {
      console.error('Switch failed:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  const getHealthPercentage = (current: number, max: number) => {
    return Math.max(0, (current / max) * 100);
  };

  const getHealthBarColor = (percentage: number) => {
    if (percentage > 70) return 'bg-green-500';
    if (percentage > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const StatComparison = ({ 
    label, 
    activeValue, 
    newValue 
  }: { 
    label: string; 
    activeValue: number; 
    newValue: number; 
  }) => {
    const diff = newValue - activeValue;
    const diffColor = diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-600';
    const diffIcon = diff > 0 ? '↑' : diff < 0 ? '↓' : '=';

    return (
      <div className="flex justify-between items-center py-1">
        <span className="text-sm text-gray-600">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm">{activeValue}</span>
          <span className="text-gray-400">→</span>
          <span className="text-sm font-medium">{newValue}</span>
          <span className={`text-xs ${diffColor} font-bold`}>
            {diff !== 0 && `${diffIcon}${Math.abs(diff)}`}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">Switch Monster</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            disabled={isConfirming}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Current Status */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-blue-900">Switch Status</h3>
              <span className="text-sm text-blue-700">
                {switchesUsed}/{maxSwitches} switches used
              </span>
            </div>
            
            {switchCooldown > 0 && (
              <p className="text-sm text-yellow-700 bg-yellow-100 p-2 rounded">
                Cooldown: {switchCooldown} blocks remaining
              </p>
            )}
            
            {switchesUsed >= maxSwitches && (
              <p className="text-sm text-red-700 bg-red-100 p-2 rounded">
                Maximum switches reached for this combat
              </p>
            )}
          </div>

          {/* Current Active Monster */}
          {activeMonster && (
            <div className="mb-6">
              <h3 className="font-medium text-gray-800 mb-3">Current Active Monster</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-blue-900">{activeMonster.name}</h4>
                    <p className="text-sm text-blue-700">Level {activeMonster.level}</p>
                  </div>
                  <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    ACTIVE
                  </span>
                </div>
                
                {/* Health Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-blue-700 mb-1">
                    <span>HP</span>
                    <span>{activeMonster.health}/{activeMonster.maxHealth}</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getHealthBarColor(getHealthPercentage(activeMonster.health, activeMonster.maxHealth))}`}
                      style={{ width: `${getHealthPercentage(activeMonster.health, activeMonster.maxHealth)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Available Monsters */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-3">
              Available Monsters ({availableMonsters.length})
            </h3>
            
            {availableMonsters.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No healthy monsters available for switching</p>
                <p className="text-sm">All bench monsters are fainted</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {availableMonsters.map((monster) => (
                  <div
                    key={monster.id}
                    className={`
                      border-2 rounded-lg p-4 cursor-pointer transition-all
                      ${selectedMonster?.id === monster.id
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400 bg-white'
                      }
                      ${!canSwitch ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    onClick={() => canSwitch && setSelectedMonster(monster)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-gray-800">{monster.name}</h4>
                        <p className="text-sm text-gray-600">Level {monster.level}</p>
                      </div>
                      {selectedMonster?.id === monster.id && (
                        <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">
                          SELECTED
                        </span>
                      )}
                    </div>

                    {/* Health Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>HP</span>
                        <span>{monster.health}/{monster.maxHealth}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getHealthBarColor(getHealthPercentage(monster.health, monster.maxHealth))}`}
                          style={{ width: `${getHealthPercentage(monster.health, monster.maxHealth)}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats Comparison */}
                    {selectedMonster?.id === monster.id && activeMonster && (
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <h5 className="text-sm font-medium text-green-800 mb-2">Stat Changes</h5>
                        <div className="space-y-1">
                          <StatComparison 
                            label="Attack" 
                            activeValue={activeMonster.monster.attackPower} 
                            newValue={monster.monster.attackPower} 
                          />
                          <StatComparison 
                            label="Defense" 
                            activeValue={activeMonster.monster.defense} 
                            newValue={monster.monster.defense} 
                          />
                          <StatComparison 
                            label="Speed" 
                            activeValue={activeMonster.monster.speed} 
                            newValue={monster.monster.speed} 
                          />
                          <StatComparison 
                            label="Magic" 
                            activeValue={activeMonster.monster.magicAttack} 
                            newValue={monster.monster.magicAttack} 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Transaction Warning */}
          {selectedMonster && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-2">Transaction Required</h4>
              <p className="text-sm text-yellow-700">
                Switching monsters requires a blockchain transaction. This will:
              </p>
              <ul className="text-sm text-yellow-700 mt-1 ml-4 list-disc">
                <li>Cost gas fees</li>
                <li>Take a few seconds to confirm</li>
                <li>End your current turn</li>
                <li>Apply a cooldown to the switched-out monster</li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={isConfirming}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmSwitch}
            disabled={!selectedMonster || !canSwitch || isConfirming}
            className={`
              px-6 py-2 rounded-md font-medium transition-colors
              ${selectedMonster && canSwitch && !isConfirming
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {isConfirming ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Switching...
              </div>
            ) : (
              'Confirm Switch'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonsterSwitchModal;