import React from 'react';
import PlayerStats from './PlayerStats';
import MonsterCard from './MonsterCard';
import ActionButtons from './ActionButtons';
import { useCombat } from '../../hooks/useCombat';

const CombatArena: React.FC = () => {
    const { playerStats, currentMonster, combatActions } = useCombat();

    return (
        <div className="combat-arena">
            <h2 className="text-2xl font-bold">Combat Arena</h2>
            <div className="flex flex-col md:flex-row">
                <div className="player-stats w-full md:w-1/3">
                    <PlayerStats stats={playerStats} />
                </div>
                <div className="monster-card w-full md:w-1/3">
                    <MonsterCard monster={currentMonster} />
                </div>
                <div className="action-buttons w-full md:w-1/3">
                    <ActionButtons actions={combatActions} />
                </div>
            </div>
        </div>
    );
};

export default CombatArena;