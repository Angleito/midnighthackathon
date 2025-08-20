import React from 'react';

const Header: React.FC = () => {
    return (
        <header className="bg-blue-600 text-white p-4">
            <h1 className="text-2xl font-bold">ZK Ocean Combat</h1>
            <nav className="mt-2">
                <ul className="flex space-x-4">
                    <li><a href="#combat" className="hover:underline">Combat</a></li>
                    <li><a href="#monsters" className="hover:underline">Monsters</a></li>
                    <li><a href="#about" className="hover:underline">About</a></li>
                </ul>
            </nav>
        </header>
    );
};

export default Header;