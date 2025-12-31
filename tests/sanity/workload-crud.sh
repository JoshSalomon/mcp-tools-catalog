#!/bin/bash
#
# MCP Entity API - Workload CRUD Test Script (005-workload-local-db)
#
# This script tests the database-only workload operations:
# - T014: POST /workloads (create)
# - T021: GET /workloads, GET /workloads/:ns/:name (list/get)
# - T030: PUT /workloads/:ns/:name (update and rename)
# - T035: DELETE /workloads/:ns/:name (permanent delete)
# - T036: Verify no zombie reappearance after delete
#
# Usage: ./workload-crud.sh [--skip-cleanup] [--verbose]
#
# Prerequisites:
#   - oc CLI configured and logged in
#   - Backstage deployed with MCP Entity API
#

set -o pipefail

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Test entity names (will be cleaned up)
TEST_WORKLOAD_1="test-wl-crud-1-$$"
TEST_WORKLOAD_2="test-wl-crud-2-$$"
TEST_WORKLOAD_RENAME="test-wl-renamed-$$"

# Track created entities for cleanup
CREATED_WORKLOADS=()

# Options
SKIP_CLEANUP=false
VERBOSE=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0

# =============================================================================
# Parse Arguments
# =============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-cleanup)
            SKIP_CLEANUP=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--skip-cleanup] [--verbose]"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

log_verbose() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${CYAN}[DEBUG]${NC} $1"
    fi
}

# =============================================================================
# Prerequisites Check
# =============================================================================

echo -e "${YELLOW}===============================================================${NC}"
echo -e "${YELLOW}  Workload CRUD Tests (005-workload-local-db)${NC}"
echo -e "${YELLOW}===============================================================${NC}"

# Check oc CLI
if ! command -v oc &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} oc CLI not found"
    exit 1
fi

# Check login
if ! oc whoami &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} Not logged in to OpenShift"
    exit 1
fi
log_pass "Logged in as: $(oc whoami)"

# Get Backstage URL
if [[ -z "$BACKSTAGE_URL" ]]; then
    log_info "BACKSTAGE_URL not set, getting from cluster..."
    BACKSTAGE_URL="https://$(oc get route backstage -n backstage -o jsonpath='{.spec.host}')"
fi
log_pass "Backstage URL: $BACKSTAGE_URL"

# Get auth token
TOKEN=$(oc whoami -t)
if [[ -z "$TOKEN" ]]; then
    echo -e "${RED}[ERROR]${NC} Failed to get authentication token"
    exit 1
fi
log_pass "Authentication token obtained"

# Test API health
HEALTH_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "${BACKSTAGE_URL}/api/mcp-entity-api/health")
if [[ "$HEALTH_CODE" != "200" ]]; then
    echo -e "${RED}[ERROR]${NC} MCP Entity API not healthy (HTTP $HEALTH_CODE)"
    exit 1
fi
log_pass "MCP Entity API is healthy"

# =============================================================================
# Test Functions
# =============================================================================

# T014: Test POST /workloads (create)
test_create_workload() {
    echo ""
    echo -e "${YELLOW}Test: Create Workload (T014)${NC}"

    local response
    local http_code

    # Create first workload
    log_info "Creating workload: $TEST_WORKLOAD_1"
    response=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/workloads" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {
                \"name\": \"$TEST_WORKLOAD_1\",
                \"description\": \"Test workload for CRUD tests\"
            },
            \"spec\": {
                \"type\": \"mcp-workload\",
                \"lifecycle\": \"experimental\",
                \"owner\": \"user:default/test\",
                \"dependsOn\": []
            }
        }" \
        -w "\n%{http_code}")

    http_code=$(echo "$response" | tail -1)
    log_verbose "Response code: $http_code"

    if [[ "$http_code" == "201" ]]; then
        log_pass "POST /workloads returned 201 Created"
        CREATED_WORKLOADS+=("$TEST_WORKLOAD_1")
    else
        log_fail "POST /workloads expected 201, got $http_code"
        return 1
    fi

    # Test duplicate name returns 409
    log_info "Testing duplicate name (expecting 409 Conflict)"
    http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/workloads" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {\"name\": \"$TEST_WORKLOAD_1\"},
            \"spec\": {\"type\": \"mcp-workload\"}
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "409" ]]; then
        log_pass "Duplicate name returns 409 Conflict"
    else
        log_fail "Duplicate name expected 409, got $http_code"
    fi

    # Create second workload for rename test
    log_info "Creating second workload: $TEST_WORKLOAD_2"
    http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/workloads" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {\"name\": \"$TEST_WORKLOAD_2\"},
            \"spec\": {\"type\": \"mcp-workload\", \"lifecycle\": \"production\"}
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "201" ]]; then
        log_pass "Second workload created successfully"
        CREATED_WORKLOADS+=("$TEST_WORKLOAD_2")
    else
        log_fail "Second workload creation expected 201, got $http_code"
    fi
}

# T021: Test GET /workloads (list and get)
test_list_get_workload() {
    echo ""
    echo -e "${YELLOW}Test: List and Get Workloads (T021)${NC}"

    local response
    local http_code
    local count

    # Test list workloads (no auth required)
    log_info "Testing GET /workloads (list, no auth)"
    response=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/workloads" -w "\n%{http_code}")
    http_code=$(echo "$response" | tail -1)

    if [[ "$http_code" == "200" ]]; then
        log_pass "GET /workloads returned 200 OK (public read)"
    else
        log_fail "GET /workloads expected 200, got $http_code"
    fi

    # Verify our test workloads are in the list
    count=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/workloads" | jq "[.items[] | select(.metadata.name | startswith(\"test-wl-crud\"))] | length")
    if [[ "$count" -ge 2 ]]; then
        log_pass "Test workloads found in list (count: $count)"
    else
        log_fail "Test workloads not found in list (count: $count, expected >= 2)"
    fi

    # Test get specific workload (no auth required)
    log_info "Testing GET /workloads/default/$TEST_WORKLOAD_1"
    http_code=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/default/$TEST_WORKLOAD_1" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "200" ]]; then
        log_pass "GET /workloads/:ns/:name returned 200 OK"
    else
        log_fail "GET /workloads/:ns/:name expected 200, got $http_code"
    fi

    # Verify workload data
    local name
    name=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/default/$TEST_WORKLOAD_1" | jq -r '.metadata.name')
    if [[ "$name" == "$TEST_WORKLOAD_1" ]]; then
        log_pass "Workload data is correct"
    else
        log_fail "Workload name mismatch: expected $TEST_WORKLOAD_1, got $name"
    fi

    # Test get non-existent workload returns 404
    log_info "Testing GET non-existent workload (expecting 404)"
    http_code=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/default/non-existent-workload-xyz" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "404" ]]; then
        log_pass "Non-existent workload returns 404 Not Found"
    else
        log_fail "Non-existent workload expected 404, got $http_code"
    fi
}

# T030: Test PUT /workloads (update and rename)
test_update_rename_workload() {
    echo ""
    echo -e "${YELLOW}Test: Update and Rename Workload (T030)${NC}"

    local http_code
    local description

    # Test update without rename
    log_info "Testing PUT /workloads (update description)"
    http_code=$(curl -sk -X PUT "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/default/$TEST_WORKLOAD_1" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {
                \"name\": \"$TEST_WORKLOAD_1\",
                \"description\": \"Updated description\"
            },
            \"spec\": {
                \"type\": \"mcp-workload\",
                \"lifecycle\": \"production\"
            }
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "200" ]]; then
        log_pass "PUT /workloads (update) returned 200 OK"
    else
        log_fail "PUT /workloads (update) expected 200, got $http_code"
    fi

    # Verify update persisted
    description=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/default/$TEST_WORKLOAD_1" | jq -r '.metadata.description')
    if [[ "$description" == "Updated description" ]]; then
        log_pass "Update persisted correctly"
    else
        log_fail "Update not persisted: got '$description'"
    fi

    # Test rename
    log_info "Testing PUT /workloads (rename $TEST_WORKLOAD_2 -> $TEST_WORKLOAD_RENAME)"
    http_code=$(curl -sk -X PUT "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/default/$TEST_WORKLOAD_2" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {
                \"name\": \"$TEST_WORKLOAD_RENAME\",
                \"description\": \"Renamed workload\"
            },
            \"spec\": {
                \"type\": \"mcp-workload\"
            }
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "200" ]]; then
        log_pass "PUT /workloads (rename) returned 200 OK"
        # Update tracking for cleanup
        CREATED_WORKLOADS=("${CREATED_WORKLOADS[@]/$TEST_WORKLOAD_2/}")
        CREATED_WORKLOADS+=("$TEST_WORKLOAD_RENAME")
    else
        log_fail "PUT /workloads (rename) expected 200, got $http_code"
    fi

    # Verify old name returns 404
    log_info "Verifying old name returns 404"
    http_code=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/default/$TEST_WORKLOAD_2" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "404" ]]; then
        log_pass "Old name returns 404 (rename successful)"
    else
        log_fail "Old name expected 404, got $http_code"
    fi

    # Verify new name exists
    log_info "Verifying new name exists"
    http_code=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/default/$TEST_WORKLOAD_RENAME" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "200" ]]; then
        log_pass "New name returns 200 (rename verified)"
    else
        log_fail "New name expected 200, got $http_code"
    fi

    # Test rename to existing name returns 409
    log_info "Testing rename to existing name (expecting 409)"
    http_code=$(curl -sk -X PUT "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/default/$TEST_WORKLOAD_RENAME" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {\"name\": \"$TEST_WORKLOAD_1\"},
            \"spec\": {\"type\": \"mcp-workload\"}
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "409" ]]; then
        log_pass "Rename to existing name returns 409 Conflict"
    else
        log_fail "Rename to existing expected 409, got $http_code"
    fi
}

# T035, T036: Test DELETE /workloads (permanent delete, no zombie)
test_delete_workload() {
    echo ""
    echo -e "${YELLOW}Test: Delete Workload - Permanent, No Zombie (T035, T036)${NC}"

    local http_code

    # Delete first workload
    log_info "Deleting workload: $TEST_WORKLOAD_1"
    http_code=$(curl -sk -X DELETE "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/default/$TEST_WORKLOAD_1" \
        -H "Authorization: Bearer $TOKEN" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "204" ]]; then
        log_pass "DELETE /workloads returned 204 No Content"
        CREATED_WORKLOADS=("${CREATED_WORKLOADS[@]/$TEST_WORKLOAD_1/}")
    else
        log_fail "DELETE /workloads expected 204, got $http_code"
    fi

    # Verify immediate 404
    log_info "Verifying immediate 404 after delete"
    http_code=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/default/$TEST_WORKLOAD_1" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "404" ]]; then
        log_pass "Deleted workload returns 404 immediately"
    else
        log_fail "Deleted workload expected 404, got $http_code"
    fi

    # T036: Verify no zombie reappearance
    log_info "Waiting 3 seconds to verify no zombie reappearance..."
    sleep 3

    http_code=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/default/$TEST_WORKLOAD_1" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "404" ]]; then
        log_pass "No zombie reappearance after 3 seconds"
    else
        log_fail "ZOMBIE DETECTED! Workload reappeared with code $http_code"
    fi

    # Delete second attempt on same workload should return 404
    log_info "Testing double-delete returns 404"
    http_code=$(curl -sk -X DELETE "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/default/$TEST_WORKLOAD_1" \
        -H "Authorization: Bearer $TOKEN" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "404" ]]; then
        log_pass "Double-delete returns 404 Not Found"
    else
        log_fail "Double-delete expected 404, got $http_code"
    fi
}

# =============================================================================
# Cleanup
# =============================================================================

cleanup() {
    echo ""
    echo -e "${YELLOW}===============================================================${NC}"
    echo -e "${YELLOW}  Cleanup${NC}"
    echo -e "${YELLOW}===============================================================${NC}"

    if [[ "$SKIP_CLEANUP" == "true" ]]; then
        log_info "Skipping cleanup (--skip-cleanup specified)"
        log_info "Created workloads: ${CREATED_WORKLOADS[*]}"
        return
    fi

    for workload in "${CREATED_WORKLOADS[@]}"; do
        if [[ -n "$workload" ]]; then
            log_info "Deleting: $workload"
            curl -sk -X DELETE "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/default/$workload" \
                -H "Authorization: Bearer $TOKEN" -o /dev/null
        fi
    done

    log_pass "Cleanup complete"
}

# Set trap for cleanup on exit
trap cleanup EXIT

# =============================================================================
# Run Tests
# =============================================================================

test_create_workload
test_list_get_workload
test_update_rename_workload
test_delete_workload

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${YELLOW}===============================================================${NC}"
echo -e "${YELLOW}  Test Summary${NC}"
echo -e "${YELLOW}===============================================================${NC}"
echo ""
echo -e "  ${GREEN}Passed:${NC}  $TESTS_PASSED"
echo -e "  ${RED}Failed:${NC}  $TESTS_FAILED"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}+---------------------------------------------------------------+${NC}"
    echo -e "${GREEN}|  ALL WORKLOAD CRUD TESTS PASSED                               |${NC}"
    echo -e "${GREEN}+---------------------------------------------------------------+${NC}"
    exit 0
else
    echo -e "${RED}+---------------------------------------------------------------+${NC}"
    echo -e "${RED}|  SOME TESTS FAILED                                            |${NC}"
    echo -e "${RED}+---------------------------------------------------------------+${NC}"
    exit 1
fi
