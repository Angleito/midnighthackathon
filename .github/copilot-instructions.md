# ZK Ocean Combat - GitHub Copilot Instructions

## Project Overview

This project is a zero-knowledge proof-based ocean combat game using the Midnight Protocol. It features turn-based combat mechanics with privacy-preserving gameplay through ZK proofs, built with React, TypeScript, and Tailwind CSS.

## Core Development Methodology

Always follow the THINK-PLAN-EXECUTE process:
1. **THINK** - Analyze ZK requirements and game mechanics
2. **PLAN** - Design state management and proof generation  
3. **EXECUTE** - Implement with TypeScript, React, and Midnight SDK

## Technology Stack

- **Frontend**: React with TypeScript, Tailwind CSS
- **Zero-Knowledge**: Midnight Protocol (@midnight-ntwrk packages)
- **Build Tool**: Vite
- **Testing**: Jest/Vitest for unit tests
- **Blockchain**: Compact runtime for ZK operations

## Project Structure

- `src/components/` - React UI components for game rendering
- `src/lib/combat/` - Core game mechanics and combat engine
- `src/hooks/` - Custom React hooks for game logic
- `src/contracts/` - Midnight smart contracts (.compact files)
- `src/types/` - TypeScript type definitions
- `src/assets/` - Game assets and images
- `tests/` - Test files for components and ZK proofs

## Coding Standards

### TypeScript Guidelines
- Enable strict mode in tsconfig.json
- Define interfaces for all game entities and ZK proofs
- Use type guards for runtime type checking
- Avoid `any` type - use `unknown` or generics instead
- Use PascalCase for component names, interfaces, and type aliases
- Use camelCase for variables, functions, and methods
- Use UPPER_SNAKE_CASE for constants
- Prefix interfaces with I (e.g., IGameState)
- Suffix types with Type (e.g., MoveType)

### React Patterns
- Use functional components with hooks exclusively
- Implement proper state management with Context API or reducers
- Optimize re-renders with React.memo and useMemo
- Follow React hooks rules (no conditional hooks)
- Keep components small and focused
- Use CSS modules or Tailwind for component styling

### Zero-Knowledge Guidelines
- Use @midnight-ntwrk packages for all ZK operations
- Implement proper wallet connection via DApp Connector API
- Handle compact runtime operations efficiently
- Ensure privacy preservation in all combat moves
- Never expose ship positions in clear text
- Generate proofs for all combat actions
- Verify moves without revealing strategy
- Maintain fog of war through ZK proofs

## Performance Requirements

### React Optimization
- Use React.memo for expensive components
- Implement virtual scrolling for large lists
- Debounce user inputs
- Lazy load game assets

### ZK Performance
- Generate proofs asynchronously
- Use Web Workers for proof computation when possible
- Cache proof artifacts
- Minimize proof size for network efficiency
- Batch proof generation when possible

## Error Handling

### User Experience
- Show clear error messages for failed proofs
- Handle wallet disconnection gracefully
- Provide fallback UI for loading states
- Log errors for debugging

### Game Integrity
- Validate all moves before proof generation
- Handle network failures with retry logic
- Maintain game state consistency
- Implement rollback for invalid moves

## Code Organization

### Separation of Concerns
- **Presentation Layer** (`src/components/`): React components for UI rendering, game board visualization, combat animations
- **Game Logic** (`src/lib/`): Turn-based combat mechanics, ship movement and targeting, damage calculation
- **ZK Layer** (`src/zk/`): Proof generation for moves, move verification, Midnight contract interactions  
- **Wallet Integration** (`src/hooks/`): Midnight wallet connection, transaction signing, account management

### File Naming Conventions
- Use PascalCase for React components (e.g., `CombatArena.tsx`)
- Use camelCase for utility functions and hooks (e.g., `useCombat.ts`)
- Use kebab-case for asset files (e.g., `monster-sprites.png`)

## Testing Strategy

- Test React components in isolation
- Verify game state transitions
- Test ZK proof generation and verification
- Validate wallet connection flows
- Test complete game rounds
- Verify Midnight contract interactions

## Documentation Requirements

- Document complex ZK algorithms with inline comments
- Explain game state transitions in component docs
- Comment proof verification logic thoroughly
- Document Midnight contract interfaces
- Maintain README with setup instructions and game rules

## Security Considerations

- Validate all user inputs before processing
- Sanitize data before ZK proof generation
- Implement proper error boundaries
- Use secure randomness for game mechanics
- Protect against timing attacks in ZK operations

## Development Workflow

When implementing new features:
1. Design the game mechanic or ZK feature first
2. Implement TypeScript interfaces and types
3. Build React components with proper state management
4. Integrate with Midnight Protocol
5. Test proof generation and verification
6. Add comprehensive error handling
7. Document the implementation

Always prioritize privacy-first design and ensure all combat actions are properly verified through zero-knowledge proofs.
