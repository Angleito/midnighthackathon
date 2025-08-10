import React from 'react';

interface PlayerStatsProps {
    health: number;
    attackPower: number;
    defense: number;
    speed: number;
}

const PlayerStats: React.FC<PlayerStatsProps> = ({ health, attackPower, defense, speed }) => {
    return (
        <div className="player-stats">
            <h2 className="text-lg font-bold">Player Stats</h2>
            <ul className="stats-list">
                <li>Health: {health}</li>
                <li>Attack Power: {attackPower}</li>
                <li>Defense: {defense}</li>
                <li>Speed: {speed}</li>
            </ul>
        </div>
    );
};

export default PlayerStats;