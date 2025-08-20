import React from 'react';
import { PlayerStats as PlayerStatsType } from '../../types/combat';

interface PlayerStatsProps {
    stats: PlayerStatsType | null;
}

const PlayerStats: React.FC<PlayerStatsProps> = ({ stats }) => {
    if (!stats) {
        return (
            <div className="player-stats">
                <h2 className="text-lg font-bold">Player Stats</h2>
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <div className="player-stats">
            <h2 className="text-lg font-bold">Player Stats</h2>
            <ul className="stats-list">
                <li>Health: {stats.health}</li>
                <li>Attack Power: {stats.attackPower}</li>
                <li>Defense: {stats.defense}</li>
                <li>Speed: {stats.speed}</li>
                <li>Magic Attack: {stats.magicAttack}</li>
                <li>Magic Defense: {stats.magicDefense}</li>
            </ul>
        </div>
    );
};

export default PlayerStats;