#!/bin/bash

echo "🌙 Setting up ZK Ocean Combat for Midnight Testnet Deployment"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"

# Pull and start proof server
echo "📡 Setting up Midnight Proof Server..."
docker pull midnightnetwork/proof-server:latest

# Stop existing container if running
docker stop midnight-proof-server 2>/dev/null || true
docker rm midnight-proof-server 2>/dev/null || true

# Start proof server
docker run -d -p 6300:6300 --name midnight-proof-server \
    midnightnetwork/proof-server -- \
    'midnight-proof-server --network testnet'

echo "⏳ Waiting for proof server to start..."
sleep 5

# Check if proof server is responding
if curl -f http://localhost:6300/health > /dev/null 2>&1; then
    echo "✅ Proof server is running on http://localhost:6300"
else
    echo "⚠️  Proof server may still be starting. Check docker logs midnight-proof-server"
fi

echo ""
echo "🚀 Testnet Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Install Lace wallet Chrome extension"
echo "2. Get testnet tokens from: https://midnight.network/test-faucet/"
echo "3. Run: npm run dev"
echo "4. Connect wallet to deploy contracts"
echo ""
echo "To check proof server status:"
echo "  docker logs midnight-proof-server"
echo ""
echo "To stop proof server:"
echo "  docker stop midnight-proof-server"