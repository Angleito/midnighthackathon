import React from 'react';
import { MonsterSlot } from '../../services/monsterInventoryService';

interface MonsterRosterProps {
  activeMonster: MonsterSlot | null;
  benchMonsters: MonsterSlot[];
  switchesUsed: number;
  maxSwitches: number;
  switchCooldown: number;
  onSwitchClick?: (targetMonster: MonsterSlot) => void;
  isTransactionPending?: boolean;
}

const MonsterRoster: React.FC<MonsterRosterProps> = ({
  activeMonster,
  benchMonsters,
  switchesUsed,
  maxSwitches,
  switchCooldown,
  onSwitchClick,
  isTransactionPending = false
}) => {
  const getHealthPercentage = (current: number, max: number) => {
    return Math.max(0, (current / max) * 100);
  };

  const getHealthBarColor = (percentage: number) => {
    if (percentage > 70) return 'bg-green-500';
    if (percentage > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const canSwitch = (monster: MonsterSlot) => {
    return !isTransactionPending && 
           monster.health > 0 && 
           switchesUsed < maxSwitches && 
           switchCooldown === 0;
  };

  const MonsterCard = ({ 
    monster, 
    isActive, 
    onClick 
  }: { 
    monster: MonsterSlot; 
    isActive: boolean; 
    onClick?: () => void; 
  }) => {
    const healthPercentage = getHealthPercentage(monster.health, monster.maxHealth);
    const isFainted = monster.health <= 0;
    const clickable = !isActive && onClick && canSwitch(monster);

    return (
      <div 
        className={`
          border-2 rounded-lg p-3 transition-all duration-200
          ${isActive 
            ? 'border-blue-500 bg-blue-50 shadow-lg' 
            : isFainted 
              ? 'border-gray-300 bg-gray-100 opacity-60'
              : clickable
                ? 'border-gray-400 bg-white hover:border-blue-400 hover:shadow-md cursor-pointer'
                : 'border-gray-300 bg-gray-50'
          }
          ${isTransactionPending && !isActive ? 'pointer-events-none opacity-50' : ''}
        `}
        onClick={clickable ? onClick : undefined}
      >
        <div className="flex justify-between items-start mb-2">
          <div>
            <h4 className={`font-bold text-sm ${isFainted ? 'text-gray-500' : 'text-gray-800'}`}>
              {monster.name}
            </h4>
            <p className="text-xs text-gray-600">Level {monster.level}</p>
          </div>
          {isActive && (
            <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">
              ACTIVE
            </span>
          )}
          {isFainted && (
            <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">
              FAINTED
            </span>
          )}
        </div>

        {/* Health Bar */}
        <div className="mb-2">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>HP</span>
            <span>{monster.health}/{monster.maxHealth}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getHealthBarColor(healthPercentage)}`}
              style={{ width: `${healthPercentage}%` }}
            />
          </div>
        </div>

        {/* Stats Preview */}
        <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
          <div>ATK: {monster.monster.attackPower}</div>
          <div>DEF: {monster.monster.defense}</div>
          <div>SPD: {monster.monster.speed}</div>
          <div>MAG: {monster.monster.magicAttack}</div>
        </div>

        {/* Switch Button for Bench Monsters */}
        {!isActive && !isFainted && (
          <button
            className={`
              w-full mt-2 py-1 px-2 text-xs font-medium rounded transition-colors
              ${canSwitch(monster)
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
            onClick={onClick}
            disabled={!canSwitch(monster)}
          >
            {isTransactionPending ? 'Processing...' : 'Switch In'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="monster-roster bg-white border border-gray-300 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800">Monster Roster</h3>
        <div className="text-sm text-gray-600">
          Switches: {switchesUsed}/{maxSwitches}
        </div>
      </div>

      {/* Switch Status */}
      {switchCooldown > 0 && (
        <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          Switch cooldown: {switchCooldown} blocks remaining
        </div>
      )}

      {switchesUsed >= maxSwitches && (
        <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          Maximum switches used for this combat
        </div>
      )}

      {/* Active Monster */}
      {activeMonster && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Active Monster</h4>
          <MonsterCard monster={activeMonster} isActive={true} />
        </div>
      )}

      {/* Bench Monsters */}
      {benchMonsters.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Bench ({benchMonsters.length}/5)
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {benchMonsters.map((monster) => (
              <MonsterCard
                key={monster.id}
                monster={monster}
                isActive={false}
                onClick={() => onSwitchClick && onSwitchClick(monster)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty Roster State */}
      {!activeMonster && benchMonsters.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          <p>No monsters in roster</p>
          <p className="text-sm">Add monsters to your team first</p>
        </div>
      )}

      {/* Transaction Status */}
      {isTransactionPending && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <div className="flex items-center text-blue-800">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-800 mr-2"></div>
            <span className="text-sm">Processing monster switch...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonsterRoster;