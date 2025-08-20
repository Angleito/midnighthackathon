import React, { useState } from 'react';

function SimpleApp() {
  const [message, setMessage] = useState('ZK Ocean Combat - Loading Success!');

  return (
    <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>
      <h1 style={{ color: '#0066cc' }}>{message}</h1>
      <p>✅ Bun + Vite is working correctly</p>
      <p>🎮 Ready to load the full game</p>
      <button 
        onClick={() => setMessage('Blockchain transaction system ready!')}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: '#0066cc',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Test React State
      </button>
      <div style={{ marginTop: '20px' }}>
        <p>🔥 Every turn creates Midnight network transactions</p>
        <p>🔐 Monster stats hidden via ZK commitments</p>
        <p>⚔️ Monster switching counts as turns</p>
      </div>
    </div>
  );
}

export default SimpleApp;