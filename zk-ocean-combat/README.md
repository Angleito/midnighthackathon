# zk-ocean-combat

## Project Overview
The zk-ocean-combat project is a mobile-first web application that demonstrates privacy-preserving turn-based combat using the Midnight Protocol's zero-knowledge (ZK) capabilities. The application allows players to engage in combat with various ocean-themed monsters while keeping their combat statistics private.

## Features
- **Turn-Based Combat:** Engage in strategic battles against NPC monsters with alternating turns.
- **Privacy-Preserving Mechanics:** Combat statistics and calculations are hidden using zero-knowledge proofs.
- **Mobile-Friendly Design:** Optimized for mobile browsers with a responsive layout.
- **Open Source:** The project is licensed under the Apache 2.0 license and is available on GitHub.

## Getting Started

### Prerequisites
- Node.js (version 24 or higher)
- Bun (for package management)
- Vite (for development server and build)

### Installation
1. Clone the repository:
   ```
   git clone https://github.com/yourusername/zk-ocean-combat.git
   cd zk-ocean-combat
   ```

2. Install dependencies using Bun:
   ```
   bun install
   ```

3. Alternatively, install dependencies using npm:
   ```
   npm install
   ```

### Running the Application
To start the development server, run:
```
bun dev
```
or
```
npm run dev
```

Open your browser and navigate to `http://localhost:3000` to view the application.

### Building for Production
To build the application for production, run:
```
bun build
```
or
```
npm run build
```

The production-ready files will be generated in the `dist` directory.

## Project Structure
- **src/**: Contains the source code for the application.
  - **contracts/**: Compact language smart contracts for combat mechanics.
  - **components/**: React components for the UI.
  - **hooks/**: Custom hooks for managing state and interactions.
  - **lib/**: Utility functions and libraries for combat and blockchain interactions.
  - **styles/**: Global CSS styles.
  - **types/**: TypeScript type definitions.
- **public/**: Static assets and PWA configuration.
- **tests/**: Unit tests for combat logic and zero-knowledge proofs.
- **.env.example**: Example environment configuration.
- **package.json**: Project metadata and dependencies.
- **vite.config.ts**: Vite configuration file.

## Documentation
For detailed documentation on the implementation, including setup instructions and usage guidelines, refer to the code comments and inline documentation throughout the project files.

## License
This project is licensed under the Apache 2.0 License. See the LICENSE file for more details.