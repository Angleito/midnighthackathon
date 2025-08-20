import React from 'react';
import { MonsterStats } from '../../types/combat';

interface MonsterCardProps {
    monster: MonsterStats | null;
}

const MonsterCard: React.FC<MonsterCardProps> = ({ monster }) => {
    if (!monster) {
        return (
            <div className="monster-card bg-white shadow-md rounded-lg p-4">
                <h2 className="text-xl font-bold">Loading Monster...</h2>
            </div>
        );
    }

    return (
        <div className="monster-card bg-white shadow-md rounded-lg p-4">
            <div className="w-full h-32 bg-blue-200 rounded-t-lg flex items-center justify-center">
                <span className="text-2xl">🐙</span>
            </div>
            <h2 className="text-xl font-bold mt-2">{monster.name}</h2>
            <div className="stats mt-2">
                <p><strong>Health:</strong> {monster.health}</p>
                <p><strong>Attack:</strong> {monster.attackPower}</p>
                <p><strong>Defense:</strong> {monster.defense}</p>
                <p><strong>Speed:</strong> {monster.speed}</p>
                <p><strong>Magic Attack:</strong> {monster.magicAttack}</p>
                <p><strong>Magic Defense:</strong> {monster.magicDefense}</p>
            </div>
        </div>
    );
};

export default MonsterCard;