import React from 'react';
import { CombatAction } from '../../types/combat';

interface ActionButtonsProps {
    actions: readonly CombatAction[];
    onAction: (action: CombatAction) => void;
    disabled?: boolean;
    switchDisabled?: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ 
    actions, 
    onAction, 
    disabled = false, 
    switchDisabled = false 
}) => {
    const isActionDisabled = (action: CombatAction) => {
        if (disabled) return true;
        if (action === 'switch' && switchDisabled) return true;
        return false;
    };

    const getButtonStyle = (action: CombatAction) => {
        const baseStyle = "px-4 py-2 rounded font-medium transition-colors";
        
        if (isActionDisabled(action)) {
            return `${baseStyle} bg-gray-300 text-gray-500 cursor-not-allowed`;
        }
        
        // Different colors for different actions
        switch (action) {
            case 'attack':
                return `${baseStyle} bg-red-500 text-white hover:bg-red-600`;
            case 'magic':
                return `${baseStyle} bg-purple-500 text-white hover:bg-purple-600`;
            case 'defend':
                return `${baseStyle} bg-green-500 text-white hover:bg-green-600`;
            case 'switch':
                return `${baseStyle} bg-blue-500 text-white hover:bg-blue-600`;
            case 'flee':
                return `${baseStyle} bg-yellow-500 text-white hover:bg-yellow-600`;
            default:
                return `${baseStyle} bg-gray-500 text-white hover:bg-gray-600`;
        }
    };

    const getActionLabel = (action: CombatAction) => {
        switch (action) {
            case 'switch': return 'Switch Monster';
            default: return action.charAt(0).toUpperCase() + action.slice(1);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            {actions.map((action) => (
                <button 
                    key={action}
                    className={getButtonStyle(action)}
                    onClick={() => onAction(action)}
                    disabled={isActionDisabled(action)}
                    title={
                        action === 'switch' && switchDisabled 
                            ? 'Switch not available' 
                            : undefined
                    }
                >
                    {getActionLabel(action)}
                </button>
            ))}
        </div>
    );
};

export default ActionButtons;