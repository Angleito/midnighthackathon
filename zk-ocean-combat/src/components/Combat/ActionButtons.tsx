import React from 'react';

interface ActionButtonsProps {
    onAttack: () => void;
    onMagicAttack: () => void;
    onDefend: () => void;
    onFlee: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ onAttack, onMagicAttack, onDefend, onFlee }) => {
    return (
        <div className="flex justify-around mt-4">
            <button className="btn" onClick={onAttack}>Attack</button>
            <button className="btn" onClick={onMagicAttack}>Magic Attack</button>
            <button className="btn" onClick={onDefend}>Defend</button>
            <button className="btn" onClick={onFlee}>Flee</button>
        </div>
    );
};

export default ActionButtons;