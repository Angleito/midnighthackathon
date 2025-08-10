import { useState, useEffect } from 'react';
import { fetchCombatData, performCombatAction } from '../lib/combat/engine';
import { PlayerStats, MonsterStats, CombatAction } from '../types/combat';

export const useCombat = (playerId: string, monsterId: string) => {
    const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
    const [monsterStats, setMonsterStats] = useState<MonsterStats | null>(null);
    const [combatLog, setCombatLog] = useState<string[]>([]);
    const [isCombatActive, setIsCombatActive] = useState<boolean>(false);

    useEffect(() => {
        const initializeCombat = async () => {
            const combatData = await fetchCombatData(playerId, monsterId);
            setPlayerStats(combatData.player);
            setMonsterStats(combatData.monster);
            setIsCombatActive(true);
        };

        initializeCombat();
    }, [playerId, monsterId]);

    const handleAction = async (action: CombatAction) => {
        if (!isCombatActive || !playerStats || !monsterStats) return;

        const result = await performCombatAction(playerId, monsterId, action);
        setCombatLog((prevLog) => [...prevLog, result.message]);

        if (result.isCombatOver) {
            setIsCombatActive(false);
        }
    };

    return {
        playerStats,
        monsterStats,
        combatLog,
        isCombatActive,
        handleAction,
    };
};

// Default export if needed
export default useCombat;