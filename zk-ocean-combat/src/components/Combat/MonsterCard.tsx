import React from 'react';

interface MonsterCardProps {
    name: string;
    health: number;
    attack: number;
    defense: number;
    imageUrl: string;
}

const MonsterCard: React.FC<MonsterCardProps> = ({ name, health, attack, defense, imageUrl }) => {
    return (
        <div className="monster-card bg-white shadow-md rounded-lg p-4">
            <img src={imageUrl} alt={name} className="w-full h-32 object-cover rounded-t-lg" />
            <h2 className="text-xl font-bold mt-2">{name}</h2>
            <div className="stats mt-2">
                <p><strong>Health:</strong> {health}</p>
                <p><strong>Attack:</strong> {attack}</p>
                <p><strong>Defense:</strong> {defense}</p>
            </div>
        </div>
    );
};

export default MonsterCard;