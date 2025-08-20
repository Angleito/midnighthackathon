import { useEffect, useState } from 'react';
import { getCurrentBlockHash } from '../lib/midnight/client';

const useBlockRandomness = () => {
    const [randomnessSeed, setRandomnessSeed] = useState<number | null>(null);

    useEffect(() => {
        const fetchBlockHash = async () => {
            try {
                const blockHash = await getCurrentBlockHash();
                const seed = parseInt(blockHash.slice(0, 8), 16) % 1000; // Use the first 8 characters of the hash for randomness
                setRandomnessSeed(seed);
            } catch (error) {
                console.error('Error fetching block hash:', error);
            }
        };

        fetchBlockHash();
    }, []);

    return randomnessSeed;
};

export default useBlockRandomness;