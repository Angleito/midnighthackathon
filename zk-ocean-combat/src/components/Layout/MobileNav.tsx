import React from 'react';
import { Link } from 'react-router-dom';

const MobileNav: React.FC = () => {
    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-4 flex justify-around">
            <Link to="/" className="text-blue-500">
                Home
            </Link>
            <Link to="/combat" className="text-blue-500">
                Combat
            </Link>
            <Link to="/wallet" className="text-blue-500">
                Wallet
            </Link>
        </nav>
    );
};

export default MobileNav;