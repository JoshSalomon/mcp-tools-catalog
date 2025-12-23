#!/bin/bash
#
# Performance, Security, and Visibility Validation Tests
# 
# Validates non-functional requirements for the MCP Entity Management API:
# - Performance: Verify <500ms p95 response time (SC-001)
# - Security: Verify 100% unauthorized requests blocked (SC-002)
# - Visibility: Verify entities visible in Catalog within 5 seconds (SC-003)
#
# Usage: ./test-performance-security-visibility.sh [--verbose]
#
# Prerequisites:
#   - oc CLI configured and logged in
#   - Backstage deployed with MCP Entity API
#   - mcp-admin role required for visibility test (T049)
#

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Test entity name
TEST_ENTITY_NAME="phase5-test-server-$$"

# Options
VERBOSE=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
TESTS_PASSED=0
TESTS_FAILED=0

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

log_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${CYAN}[DEBUG]${NC} $1"
    fi
}

log_section() {
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  $1${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
}

# Calculate percentile
calculate_percentile() {
    local percentile=$1
    local file=$2
    sort -n "$file" | awk -v p="$percentile" '
    BEGIN {
        count = 0
    }
    {
        times[count++] = $1
    }
    END {
        if (count > 0) {
            idx = int((p / 100) * count)
            if (idx >= count) idx = count - 1
            print times[idx]
        }
    }'
}

# =============================================================================
# Parse Arguments
# =============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--verbose]"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# =============================================================================
# Prerequisites Check
# =============================================================================

log_section "Prerequisites Check"

if ! command -v oc &> /dev/null; then
    log_fail "oc CLI not found"
    exit 1
fi
log_success "oc CLI found"

if ! oc whoami &> /dev/null; then
    log_fail "Not logged in to OpenShift"
    exit 1
fi
CURRENT_USER=$(oc whoami)
log_success "Logged in as: $CURRENT_USER"

if [ -n "${BACKSTAGE_URL:-}" ]; then
    if [[ ! "$BACKSTAGE_URL" =~ ^https?:// ]]; then
        BACKSTAGE_URL="https://${BACKSTAGE_URL}"
    fi
else
    BACKSTAGE_HOST=$(oc get route backstage -n backstage -o jsonpath='{.spec.host}' 2>/dev/null)
    if [ -z "$BACKSTAGE_HOST" ]; then
        log_fail "Could not find Backstage route. Set BACKSTAGE_URL environment variable."
        exit 1
    fi
    BACKSTAGE_URL="https://${BACKSTAGE_HOST}"
fi
log_success "Backstage URL: $BACKSTAGE_URL"

TOKEN=$(oc whoami -t)
if [ -z "$TOKEN" ]; then
    log_fail "Could not get authentication token"
    exit 1
fi

# =============================================================================
# T047: Performance Test (SC-001)
# =============================================================================

log_section "T047: Performance Test - <500ms p95 Response Time (SC-001)"

log_info "Running 50 requests to measure response times..."

TIMES_FILE=$(mktemp)
ITERATIONS=50

for i in $(seq 1 $ITERATIONS); do
    START=$(date +%s%N)
    curl -k -s -o /dev/null -w "%{http_code}" "${BACKSTAGE_URL}/api/mcp-entity-api/servers" > /dev/null 2>&1
    END=$(date +%s%N)
    DURATION=$(( (END - START) / 1000000 )) # Convert to milliseconds
    echo "$DURATION" >> "$TIMES_FILE"
    log_verbose "Request $i: ${DURATION}ms"
done

# Calculate p95
P95=$(calculate_percentile 95 "$TIMES_FILE")
P50=$(calculate_percentile 50 "$TIMES_FILE")
P99=$(calculate_percentile 99 "$TIMES_FILE")

log_info "Performance Results:"
log_info "  p50 (median): ${P50}ms"
log_info "  p95: ${P95}ms"
log_info "  p99: ${P99}ms"

if [ -n "$P95" ] && [ "$P95" -lt 500 ] 2>/dev/null; then
    log_success "p95 response time: ${P95}ms (target: <500ms)"
else
    log_fail "p95 response time: ${P95}ms (target: <500ms)"
fi

rm -f "$TIMES_FILE"

# =============================================================================
# T048: Security Review (SC-002)
# =============================================================================

log_section "T048: Security Review - 100% Unauthorized Requests Blocked (SC-002)"

UNAUTHORIZED_BLOCKED=0
UNAUTHORIZED_ALLOWED=0

log_info "Testing unauthorized write operations..."

# Test POST /servers without token
RESPONSE=$(curl -k -s -w "\n%{http_code}" -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/servers" \
    -H "Content-Type: application/json" \
    -d '{"metadata": {"name": "test"}, "spec": {"lifecycle": "experimental", "owner": "user:default/test", "mcp": {"connectionType": "stdio", "command": "test", "version": "1.0.0"}}}' 2>&1)
STATUS=$(echo "$RESPONSE" | tail -n1)
if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
    ((UNAUTHORIZED_BLOCKED++))
    log_success "POST /servers without token blocked (status: $STATUS)"
else
    ((UNAUTHORIZED_ALLOWED++))
    log_fail "POST /servers without token allowed (status: $STATUS) - SECURITY ISSUE!"
fi

# Test POST /tools without token
RESPONSE=$(curl -k -s -w "\n%{http_code}" -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/tools" \
    -H "Content-Type: application/json" \
    -d '{"metadata": {"name": "test"}, "spec": {"lifecycle": "experimental", "owner": "user:default/test"}}' 2>&1)
STATUS=$(echo "$RESPONSE" | tail -n1)
if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
    ((UNAUTHORIZED_BLOCKED++))
    log_success "POST /tools without token blocked (status: $STATUS)"
else
    ((UNAUTHORIZED_ALLOWED++))
    log_fail "POST /tools without token allowed (status: $STATUS) - SECURITY ISSUE!"
fi

# Test POST /workloads without token
RESPONSE=$(curl -k -s -w "\n%{http_code}" -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/workloads" \
    -H "Content-Type: application/json" \
    -d '{"metadata": {"name": "test"}, "spec": {"lifecycle": "experimental", "owner": "user:default/test"}}' 2>&1)
STATUS=$(echo "$RESPONSE" | tail -n1)
if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
    ((UNAUTHORIZED_BLOCKED++))
    log_success "POST /workloads without token blocked (status: $STATUS)"
else
    ((UNAUTHORIZED_ALLOWED++))
    log_fail "POST /workloads without token allowed (status: $STATUS) - SECURITY ISSUE!"
fi

# Test with invalid token
RESPONSE=$(curl -k -s -w "\n%{http_code}" -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/servers" \
    -H "Authorization: Bearer invalid-token-12345" \
    -H "Content-Type: application/json" \
    -d '{"metadata": {"name": "test"}, "spec": {"lifecycle": "experimental", "owner": "user:default/test", "mcp": {"connectionType": "stdio", "command": "test", "version": "1.0.0"}}}' 2>&1)
STATUS=$(echo "$RESPONSE" | tail -n1)
if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
    ((UNAUTHORIZED_BLOCKED++))
    log_success "POST /servers with invalid token blocked (status: $STATUS)"
else
    ((UNAUTHORIZED_ALLOWED++))
    log_fail "POST /servers with invalid token allowed (status: $STATUS) - SECURITY ISSUE!"
fi

TOTAL_UNAUTHORIZED_TESTS=$((UNAUTHORIZED_BLOCKED + UNAUTHORIZED_ALLOWED))
PERCENTAGE_BLOCKED=$(( (UNAUTHORIZED_BLOCKED * 100) / TOTAL_UNAUTHORIZED_TESTS ))

log_info "Security Test Results:"
log_info "  Unauthorized requests blocked: $UNAUTHORIZED_BLOCKED / $TOTAL_UNAUTHORIZED_TESTS"
log_info "  Unauthorized requests allowed: $UNAUTHORIZED_ALLOWED / $TOTAL_UNAUTHORIZED_TESTS"
log_info "  Block rate: ${PERCENTAGE_BLOCKED}%"

if [ $UNAUTHORIZED_ALLOWED -eq 0 ]; then
    log_success "100% of unauthorized requests blocked (target: 100%)"
else
    log_fail "Only ${PERCENTAGE_BLOCKED}% of unauthorized requests blocked (target: 100%)"
fi

# =============================================================================
# T049: Catalog Visibility Test (SC-003)
# =============================================================================

log_section "T049: Catalog Visibility - Entities Visible Within 5 Seconds (SC-003)"

# Check if user has admin permissions to create entities
CAN_CREATE=$(oc auth can-i create mcpservers.mcp-catalog.io 2>/dev/null)

if [ "$CAN_CREATE" != "yes" ]; then
    log_warn "User does not have permission to create entities. Skipping visibility test."
    log_info "This test requires mcp-admin role to create test entities."
else
    log_info "Creating test entity and checking catalog visibility..."
    
    # Create entity
    CREATE_START=$(date +%s)
    RESPONSE=$(curl -k -s -w "\n%{http_code}" -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/servers" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {
                \"name\": \"${TEST_ENTITY_NAME}\",
                \"namespace\": \"default\",
                \"title\": \"Phase 5 Test Server\"
            },
            \"spec\": {
                \"lifecycle\": \"experimental\",
                \"owner\": \"user:default/test\",
                \"mcp\": {
                    \"connectionType\": \"stdio\",
                    \"command\": \"test\",
                    \"version\": \"1.0.0\"
                }
            }
        }" 2>&1)
    
    CREATE_STATUS=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$CREATE_STATUS" = "201" ]; then
        log_success "Test entity created"
        
        # Poll catalog API until entity appears or timeout
        VISIBLE=false
        MAX_WAIT=5
        ELAPSED=0
        
        while [ $ELAPSED -lt $MAX_WAIT ]; do
            sleep 1
            ELAPSED=$((ELAPSED + 1))
            
            RESPONSE=$(curl -k -s "${BACKSTAGE_URL}/api/mcp-entity-api/servers" 2>&1)
            # Check if response is an array or has items property
            if echo "$RESPONSE" | jq -e '.items[]? | select(.metadata.name == "'"${TEST_ENTITY_NAME}"'")' > /dev/null 2>&1 || \
               echo "$RESPONSE" | jq -e '.[]? | select(.metadata.name == "'"${TEST_ENTITY_NAME}"'")' > /dev/null 2>&1; then
                VISIBLE=true
                break
            fi
            
            log_verbose "Entity not yet visible, waiting... (${ELAPSED}s)"
        done
        
        if [ "$VISIBLE" = true ]; then
            log_success "Entity visible in catalog within ${ELAPSED} seconds (target: <5s)"
        else
            log_fail "Entity not visible in catalog after ${ELAPSED} seconds (target: <5s)"
        fi
        
        # Cleanup test entity
        log_verbose "Cleaning up test entity..."
        CLEANUP_RESPONSE=$(curl -k -s -w "\n%{http_code}" -X DELETE \
            "${BACKSTAGE_URL}/api/mcp-entity-api/servers/default/${TEST_ENTITY_NAME}" \
            -H "Authorization: Bearer ${TOKEN}" 2>&1)
        CLEANUP_STATUS=$(echo "$CLEANUP_RESPONSE" | tail -n1)
        if [ "$CLEANUP_STATUS" = "204" ] || [ "$CLEANUP_STATUS" = "404" ]; then
            log_verbose "Test entity cleaned up successfully"
        else
            log_warn "Failed to clean up test entity (status: $CLEANUP_STATUS). Manual cleanup may be required."
        fi
    else
        log_fail "Failed to create test entity (status: $CREATE_STATUS)"
    fi
fi

# =============================================================================
# Test Summary
# =============================================================================

log_section "Test Summary"

echo ""
echo -e "  ${GREEN}Passed:${NC}  $TESTS_PASSED"
echo -e "  ${RED}Failed:${NC}  $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ALL PHASE 5 VALIDATION TESTS PASSED                         ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    EXIT_CODE=0
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  SOME TESTS FAILED                                            ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
    EXIT_CODE=1
fi

echo ""

exit $EXIT_CODE
