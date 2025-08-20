#!/bin/bash

# ZK Ocean Combat - Specific Scenario Test Runner
# This script runs targeted tests for specific scenarios and features

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to log section headers
log_section() {
    echo -e "\n${BLUE}🔍 $1${NC}"
    echo "----------------------------------------"
}

# Function to log success
log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to log error
log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to run specific test scenario
run_scenario() {
    local scenario_name="$1"
    local test_pattern="$2"
    local timeout="${3:-30000}"
    
    echo "Running scenario: $scenario_name"
    echo "Test pattern: $test_pattern"
    echo "Timeout: ${timeout}ms"
    
    if npm run test -- --grep="$test_pattern" --testTimeout="$timeout" --reporter=verbose; then
        log_success "$scenario_name completed successfully"
        return 0
    else
        log_error "$scenario_name failed"
        return 1
    fi
}

echo -e "${BLUE}🎯 ZK Ocean Combat - Specific Scenario Testing${NC}"
echo -e "${BLUE}===============================================${NC}"
echo ""

# Check command line arguments
if [ $# -eq 0 ]; then
    echo "Usage: $0 [scenario]"
    echo ""
    echo "Available scenarios:"
    echo "  transaction-flow    - Test complete transaction flows"
    echo "  monster-switching   - Test monster switching transactions"
    echo "  anti-cheat         - Test anti-cheat and privacy systems"
    echo "  performance        - Test performance under load"
    echo "  integration        - Test service integration"
    echo "  privacy           - Test privacy protection mechanisms"
    echo "  randomness        - Test verifiable randomness"
    echo "  all               - Run all specific scenarios"
    echo ""
    exit 1
fi

SCENARIO="$1"

case "$SCENARIO" in
    "transaction-flow")
        log_section "Transaction Flow Testing"
        echo "Testing complete blockchain transaction flows..."
        run_scenario "Combat Initialization Transactions" "combat initialization.*transaction" 60000
        run_scenario "Combat Action Transactions" "combat action.*transaction" 45000
        run_scenario "Transaction Confirmation Flow" "transaction.*confirm" 30000
        run_scenario "Transaction Error Handling" "transaction.*error|transaction.*fail" 30000
        ;;
        
    "monster-switching")
        log_section "Monster Switching Transaction Testing"
        echo "Testing monster switching as blockchain transactions..."
        run_scenario "Basic Monster Switch" "monster switch.*transaction" 45000
        run_scenario "Switch Cooldown Enforcement" "switch.*cooldown" 30000
        run_scenario "Switch Rate Limiting" "switch.*limit|switch.*maximum" 30000
        run_scenario "Auto-Switch on Faint" "auto.*switch|faint.*switch" 30000
        ;;
        
    "anti-cheat")
        log_section "Anti-Cheat and Privacy Testing"
        echo "Testing anti-cheat mechanisms and privacy protection..."
        run_scenario "Block Hash Randomness" "block hash.*random|randomness.*block" 30000
        run_scenario "Commitment-Reveal Pattern" "commitment.*reveal|reveal.*commit" 30000
        run_scenario "Rate Limiting" "rate limit|rapid.*action" 30000
        run_scenario "Replay Prevention" "replay.*attack|replay.*prevent" 30000
        run_scenario "Turn Timeout Enforcement" "turn.*timeout|timeout.*enforce" 30000
        ;;
        
    "performance")
        log_section "Performance Testing"
        echo "Testing system performance under various loads..."
        run_scenario "Concurrent Transactions" "concurrent.*transaction" 90000
        run_scenario "High Volume Load" "high.*volume|sustained.*load" 120000
        run_scenario "Memory Usage" "memory.*leak|memory.*usage" 90000
        run_scenario "Resource Cleanup" "resource.*cleanup|cleanup.*resource" 60000
        ;;
        
    "integration")
        log_section "Integration Testing"
        echo "Testing service integration and coordination..."
        run_scenario "Full Combat Flow" "full.*combat.*flow|complete.*combat" 120000
        run_scenario "Cross-Service Communication" "cross.*service|service.*integration" 60000
        run_scenario "State Synchronization" "state.*sync|sync.*state" 45000
        run_scenario "Error Recovery" "error.*recovery|recovery.*error" 60000
        ;;
        
    "privacy")
        log_section "Privacy Protection Testing"
        echo "Testing zero-knowledge privacy mechanisms..."
        run_scenario "ZK Proof Generation" "zk.*proof.*generat|proof.*generat.*zk" 45000
        run_scenario "ZK Proof Verification" "zk.*proof.*verif|proof.*verif.*zk" 30000
        run_scenario "Data Privacy" "private.*data|data.*privacy" 30000
        run_scenario "Anonymity Protection" "anonymity|anonymous" 30000
        ;;
        
    "randomness")
        log_section "Verifiable Randomness Testing"
        echo "Testing verifiable randomness and unpredictability..."
        run_scenario "Randomness Generation" "randomness.*generat|verifiable.*random" 30000
        run_scenario "Unpredictability" "predict.*prevent|unpredictab" 30000
        run_scenario "Block Hash Usage" "block.*hash.*random" 30000
        run_scenario "Seed Security" "seed.*security|secret.*seed" 30000
        ;;
        
    "all")
        log_section "All Specific Scenarios"
        echo "Running all specific test scenarios..."
        
        # Run each scenario
        for scenario in transaction-flow monster-switching anti-cheat performance integration privacy randomness; do
            echo ""
            echo -e "${YELLOW}Starting scenario: $scenario${NC}"
            if ./scripts/test-specific-scenarios.sh "$scenario"; then
                log_success "Scenario $scenario completed"
            else
                log_error "Scenario $scenario failed"
            fi
        done
        ;;
        
    *)
        log_error "Unknown scenario: $SCENARIO"
        echo "Use '$0' without arguments to see available scenarios"
        exit 1
        ;;
esac

log_success "Scenario testing completed: $SCENARIO"
echo ""
echo "💡 For comprehensive testing, run: npm run test:e2e"
echo "📊 For coverage analysis, run: npm run test:coverage"
echo "🚀 For stress testing, run: npm run test:stress"