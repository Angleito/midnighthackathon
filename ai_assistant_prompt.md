# AI Assistant Prompt: Create Detailed Implementation Outline

## Context & Project Overview

You are tasked with creating a **detailed technical implementation outline** for a Zero-Knowledge turn-based combat demo for the Midnight Foundation Mini DApp Hackathon. This is a focused, mobile-first web application that demonstrates privacy-preserving combat using Midnight's ZK capabilities.

## Hackathon Requirements (CRITICAL)


**Must Include:**
1. **Midnight Protocol Integration:** Use Compact language for ZK proofs and private state management
2. **Privacy as Core Feature:** Combat stats and calculations must be meaningfully hidden via ZK
3. **Focused Scope:** Single specific feature (turn-based combat) not a full game
4. **Mobile-Friendly UI:** Must work well in mobile browsers
5. **Open Source:** Apache 2.0 license, public GitHub repo
6. **Mock Transactions:** No real-world value assets
7. **Clear Documentation:** README with setup instructions

**Judging Criteria (Equal Weight):**
- Technology (25%): Meaningful Midnight feature usage
- Innovation (25%): Fresh take on privacy/gaming
- Execution (25%): Polished core functionality
- Documentation (25%): Clear project goals and setup

## Technical Specifications

### Core Combat Mechanics Required:
- **Turn-based combat:** Player vs NPC with alternating turns
- **Hidden player stats:** PA, PD, MKA, MKD, HP, Speed (private via ZK)
- **Block-based randomness:** Use Midnight block hashes for damage variance and critical hits
- **3-4 Ocean monsters:** Different difficulty levels with scripted AI moves
- **Combat actions:** Physical Attack, Magic Attack, Defend, Flee
- **Mobile-first design:** Touch-friendly, responsive, works on phones

### Privacy Features (ZK Implementation):
**Private (Hidden via ZK proofs):**
- Player's exact combat statistics
- Precise damage calculations each turn  
- Critical hit rates and variance
- Equipment bonuses (if any)

**Public (Visible on Midnight ledger):**
- Combat session started: "Player vs Sea Jellyfish"
- Turn progression: "Turn 3 - Player's Move"
- Final outcome: "Player Victory" / "Player Defeated" / "Player Fled"
- Combat duration and basic flow

### Randomness Implementation:
**Block-Based Entropy:**
- Fetch current Midnight block hash during combat initiation
- Use `blockHash % 1000` as randomness seed for entire combat session
- Deterministic calculations within ZK circuit using this seed
- Different parts of hash used for: damage variance, critical hits, turn order ties

### Technology Stack:
- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS (mobile-first)
- **Blockchain:** Midnight Protocol + Compact language
- **PWA:** Mobile app-like experience
- **State Management:** React hooks (no complex state libraries)

## Existing Work vs New Development

**Pre-Existing Work (Must be disclosed in submission):**
I have an existing ocean-themed idle RPG called "Poseidon Idle" with:
- React UI components and ocean theme styling
- Turn-based combat system logic and damage calculations
- Monster data structure and combat mechanics
- Mobile PWA setup with Vite
- Combat UI components and animations

**New Work for Hackathon (What gets judged):**
- Complete migration from Sui blockchain to Midnight Protocol
- Compact language smart contracts for ZK combat
- Zero-knowledge proof generation for private combat stats  
- Block-based randomness integration
- Midnight wallet integration and transaction handling
- Privacy-preserving combat state management

## Your Task: Create Detailed Implementation Outline

Please provide a **comprehensive, step-by-step implementation plan** that includes:

### 1. **Project Architecture & Setup**
- Detailed folder structure for the new Midnight-based project
- Required dependencies and their specific versions
- Midnight development environment setup steps
- React + TypeScript + Vite configuration for ZK integration

### 2. **Compact Contract Design**
- Complete Compact contract structure with all required circuits
- Data type definitions for combat (PlayerStats, MonsterStats, CombatActions)
- Public ledger declarations for visible combat state
- Witness function declarations for private state management
- Specific implementation of block-based randomness integration

### 3. **Frontend Implementation Plan**
- Component hierarchy and React structure
- Mobile-first responsive design specifications
- Midnight wallet integration approach
- State management for combat sessions
- UI/UX flow for combat interactions

### 4. **ZK Privacy Implementation**
- Detailed explanation of what data stays private vs public
- Circuit design for combat calculations with hidden stats
- Proof generation and verification process
- How block hash randomness integrates with ZK circuits

### 5. **Mobile Optimization Strategy**
- PWA configuration and mobile app features
- Touch interaction design for combat actions
- Performance optimization for mobile browsers
- Responsive breakpoints and layout adjustments


### 7. **Testing & Deployment Plan**
- Local development and testing approach
- Mobile browser testing strategy (iOS Safari, Chrome Android)
- Midnight testnet deployment steps
- Hackathon submission checklist

### 8. **Documentation Requirements**
- README structure that satisfies 25% of judging criteria
- Code comments and inline documentation
- Setup instructions for judges to run the demo
- Clear explanation of ZK privacy features

## Output Format

Structure your response as a detailed technical specification document with:
- **Clear section headers** for each phase
- **Specific file names** and code structure
- **Implementation details** not just high-level concepts
- **Mobile-specific considerations** throughout
- **Time estimates** for each major task
- **Dependency mapping** showing what blocks what
