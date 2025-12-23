#!/bin/bash
#
# MCP Entity API - RBAC Integration Test Script
#
# This script tests the RBAC enforcement on the MCP Entity Management API:
# - Verifies permissions using 'oc auth can-i'
# - Tests API endpoints with and without authentication
# - Compares actual results with expected results
# - Cleans up test entities on completion
#
# Usage: ./test-rbac.sh [--skip-cleanup] [--verbose]
#
# Environment Variables:
#   BACKSTAGE_URL - Backstage API URL (required for non-admin users)
#                   Example: export BACKSTAGE_URL=https://backstage.apps.example.com
#
# Prerequisites:
#   - oc CLI configured and logged in
#   - Backstage deployed with MCP Entity API
#   - RBAC resources deployed (deployment/mcp-rbac.yaml)
#

set -o pipefail

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Test entity names (will be cleaned up)
TEST_SERVER_NAME="test-rbac-server-$$"
TEST_TOOL_NAME_1="test-rbac-tool-1-$$"
TEST_TOOL_NAME_2="test-rbac-tool-2-$$"
TEST_WORKLOAD_NAME="test-rbac-workload-$$"

# Track created entities for cleanup
CREATED_ENTITIES=()

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
TESTS_SKIPPED=0

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
            echo ""
            echo "Options:"
            echo "  --skip-cleanup  Don't delete test entities after tests"
            echo "  --verbose, -v   Show detailed output"
            echo ""
            echo "Environment Variables:"
            echo "  BACKSTAGE_URL   Backstage API URL (required for non-admin users)"
            echo "                   Example: export BACKSTAGE_URL=https://backstage.apps.example.com"
            echo "                   Or: BACKSTAGE_URL=https://backstage.apps.example.com $0"
            echo ""
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

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_skip() {
    echo -e "${CYAN}[SKIP]${NC} $1"
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

# Test assertion function
# Usage: assert_equals "test name" "expected" "actual"
assert_equals() {
    local test_name="$1"
    local expected="$2"
    local actual="$3"
    
    if [ "$expected" = "$actual" ]; then
        log_success "$test_name (expected: $expected, got: $actual)"
        ((TESTS_PASSED++))
        return 0
    else
        log_fail "$test_name (expected: $expected, got: $actual)"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test HTTP status code
# Usage: assert_http_status "test name" "expected_status" "actual_status"
assert_http_status() {
    local test_name="$1"
    local expected="$2"
    local actual="$3"
    
    # Handle multiple expected values (e.g., "200|201")
    if [[ "$expected" == *"|"* ]]; then
        IFS='|' read -ra EXPECTED_CODES <<< "$expected"
        for code in "${EXPECTED_CODES[@]}"; do
            if [ "$code" = "$actual" ]; then
                log_success "$test_name (expected: $expected, got: $actual)"
                ((TESTS_PASSED++))
                return 0
            fi
        done
        log_fail "$test_name (expected: $expected, got: $actual)"
        ((TESTS_FAILED++))
        return 1
    else
        assert_equals "$test_name" "$expected" "$actual"
    fi
}

# =============================================================================
# Cleanup Function
# =============================================================================

cleanup() {
    if [ "$SKIP_CLEANUP" = true ]; then
        log_warn "Skipping cleanup (--skip-cleanup specified)"
        if [ ${#CREATED_ENTITIES[@]} -gt 0 ]; then
            echo ""
            log_warn "The following test entities were NOT cleaned up:"
            for entity in "${CREATED_ENTITIES[@]}"; do
                echo "  - $entity"
            done
            echo ""
            log_warn "To clean up manually, run:"
            echo "  curl -k -X DELETE \"https://\${BACKSTAGE_URL}/api/mcp-entity-api/<type>/<namespace>/<name>\" -H \"Authorization: Bearer \$(oc whoami -t)\""
        fi
        return 0
    fi

    log_section "Cleanup"
    
    local cleanup_failed=false
    local failed_entities=()

    for entity in "${CREATED_ENTITIES[@]}"; do
        IFS=':' read -r entity_type namespace name <<< "$entity"
        
        log_info "Deleting $entity_type: $namespace/$name"
        
        local response
        response=$(curl -k -s -w "\n%{http_code}" -X DELETE \
            "${BACKSTAGE_URL}/api/mcp-entity-api/${entity_type}s/${namespace}/${name}" \
            -H "Authorization: Bearer ${TOKEN}" 2>&1)
        
        local status_code
        status_code=$(echo "$response" | tail -n1)
        
        if [ "$status_code" = "204" ] || [ "$status_code" = "404" ]; then
            log_success "Deleted $entity_type: $namespace/$name"
        else
            log_fail "Failed to delete $entity_type: $namespace/$name (status: $status_code)"
            cleanup_failed=true
            failed_entities+=("$entity")
        fi
    done

    if [ "$cleanup_failed" = true ]; then
        echo ""
        echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║  CLEANUP FAILED - MANUAL CLEANUP REQUIRED                     ║${NC}"
        echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "${YELLOW}The following entities could not be deleted:${NC}"
        for entity in "${failed_entities[@]}"; do
            IFS=':' read -r entity_type namespace name <<< "$entity"
            echo -e "  ${RED}•${NC} $entity_type: $namespace/$name"
        done
        echo ""
        echo -e "${YELLOW}To clean up manually, use these commands:${NC}"
        echo ""
        for entity in "${failed_entities[@]}"; do
            IFS=':' read -r entity_type namespace name <<< "$entity"
            echo "curl -k -X DELETE \"https://${BACKSTAGE_URL}/api/mcp-entity-api/${entity_type}s/${namespace}/${name}\" \\"
            echo "  -H \"Authorization: Bearer \$(oc whoami -t)\""
            echo ""
        done
        echo -e "${YELLOW}Or delete directly from Backstage catalog if API fails.${NC}"
        echo ""
        return 1
    fi

    log_success "All test entities cleaned up successfully"
    return 0
}

# Set up trap for cleanup on exit
trap cleanup EXIT

# =============================================================================
# Prerequisites Check
# =============================================================================

log_section "Prerequisites Check"

# Check oc CLI
if ! command -v oc &> /dev/null; then
    log_fail "oc CLI not found. Please install and configure OpenShift CLI."
    exit 1
fi
log_success "oc CLI found"

# Check oc login
if ! oc whoami &> /dev/null; then
    log_fail "Not logged in to OpenShift. Run 'oc login' first."
    exit 1
fi
CURRENT_USER=$(oc whoami)
log_success "Logged in as: $CURRENT_USER"

# Get Backstage URL
# Allow override via environment variable for non-admin users
log_verbose "Checking for BACKSTAGE_URL environment variable..."
if [ -n "${BACKSTAGE_URL:-}" ]; then
    log_info "Using Backstage URL from environment: $BACKSTAGE_URL"
    # Ensure URL starts with https:// if not already
    if [[ ! "$BACKSTAGE_URL" =~ ^https?:// ]]; then
        BACKSTAGE_URL="https://${BACKSTAGE_URL}"
        log_info "Added https:// prefix: $BACKSTAGE_URL"
    fi
else
    # Try to get route from backstage namespace
    log_info "BACKSTAGE_URL not set, attempting to get Backstage route from cluster..."
    log_verbose "Running: oc get route backstage -n backstage"
    BACKSTAGE_HOST=$(oc get route backstage -n backstage -o jsonpath='{.spec.host}' 2>&1)
    OC_EXIT_CODE=$?
    log_verbose "oc get route exit code: $OC_EXIT_CODE"
    log_verbose "Route host: ${BACKSTAGE_HOST:-<empty>}"
    
    if [ $OC_EXIT_CODE -ne 0 ] || [ -z "$BACKSTAGE_HOST" ]; then
        log_fail "Could not find Backstage route. Is Backstage deployed in 'backstage' namespace?"
        if [ $OC_EXIT_CODE -ne 0 ]; then
            log_verbose "oc get route error output: $BACKSTAGE_HOST"
            log_info "This might be a permissions issue. Non-admin users need to set BACKSTAGE_URL."
        fi
        echo ""
        log_info "For non-admin users, set BACKSTAGE_URL environment variable before running:"
        echo "  export BACKSTAGE_URL=https://backstage.apps.your-cluster.example.com"
        echo "  ./tests/sanity/test-rbac.sh"
        echo ""
        log_info "Or pass it inline:"
        echo "  BACKSTAGE_URL=https://backstage.apps.your-cluster.example.com ./tests/sanity/test-rbac.sh"
        exit 1
    fi
    BACKSTAGE_URL="https://${BACKSTAGE_HOST}"
    log_info "Found Backstage route: $BACKSTAGE_URL"
fi
log_success "Backstage URL: $BACKSTAGE_URL"

# Get token
TOKEN=$(oc whoami -t)
if [ -z "$TOKEN" ]; then
    log_fail "Could not get authentication token"
    exit 1
fi
log_success "Authentication token obtained"

# Test Backstage health
log_info "Testing Backstage health endpoint..."
HEALTH_RESPONSE=$(curl -k -s -w "\n%{http_code}" "${BACKSTAGE_URL}/api/mcp-entity-api/health" 2>&1)
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | tail -n1)
if [ "$HEALTH_STATUS" != "200" ]; then
    log_fail "Backstage health check failed (status: $HEALTH_STATUS)"
    log_verbose "Response: $(echo "$HEALTH_RESPONSE" | head -n -1)"
    exit 1
fi
log_success "Backstage MCP Entity API is healthy"

# =============================================================================
# Step 2: Check Permissions with 'oc auth can-i'
# =============================================================================

log_section "Step 2: Permission Check (oc auth can-i)"

echo ""
log_info "Checking your permissions for MCP resources..."
echo ""

# Check each permission and store results
declare -A PERMISSIONS

check_permission() {
    local resource="$1"
    local verb="$2"
    local result
    
    result=$(oc auth can-i "$verb" "$resource" 2>&1)
    PERMISSIONS["${resource}:${verb}"]="$result"
    
    if [ "$result" = "yes" ]; then
        echo -e "  ${GREEN}✓${NC} can-i $verb $resource: ${GREEN}$result${NC}"
    else
        echo -e "  ${RED}✗${NC} can-i $verb $resource: ${RED}$result${NC}"
    fi
}

echo -e "${CYAN}MCP Servers (mcpservers.mcp-catalog.io):${NC}"
check_permission "mcpservers.mcp-catalog.io" "create"
check_permission "mcpservers.mcp-catalog.io" "update"
check_permission "mcpservers.mcp-catalog.io" "delete"
check_permission "mcpservers.mcp-catalog.io" "get"

echo ""
echo -e "${CYAN}MCP Tools (mcptools.mcp-catalog.io):${NC}"
check_permission "mcptools.mcp-catalog.io" "create"
check_permission "mcptools.mcp-catalog.io" "update"
check_permission "mcptools.mcp-catalog.io" "delete"
check_permission "mcptools.mcp-catalog.io" "get"

echo ""
echo -e "${CYAN}MCP Workloads (mcpworkloads.mcp-catalog.io):${NC}"
check_permission "mcpworkloads.mcp-catalog.io" "create"
check_permission "mcpworkloads.mcp-catalog.io" "update"
check_permission "mcpworkloads.mcp-catalog.io" "delete"
check_permission "mcpworkloads.mcp-catalog.io" "get"

# Determine expected roles based on permissions
echo ""
log_info "Analyzing your role assignments..."

HAS_MCP_ADMIN=false
HAS_MCP_USER=false

if [ "${PERMISSIONS["mcpservers.mcp-catalog.io:create"]}" = "yes" ]; then
    HAS_MCP_ADMIN=true
fi
if [ "${PERMISSIONS["mcpworkloads.mcp-catalog.io:create"]}" = "yes" ]; then
    HAS_MCP_USER=true
fi

echo ""
if [ "$HAS_MCP_ADMIN" = true ]; then
    echo -e "  ${GREEN}✓${NC} You have ${GREEN}mcp-admin${NC} role (can manage servers and tools)"
else
    echo -e "  ${YELLOW}○${NC} You do NOT have ${YELLOW}mcp-admin${NC} role"
fi

if [ "$HAS_MCP_USER" = true ]; then
    echo -e "  ${GREEN}✓${NC} You have ${GREEN}mcp-user${NC} role (can manage workloads)"
else
    echo -e "  ${YELLOW}○${NC} You do NOT have ${YELLOW}mcp-user${NC} role"
fi

# =============================================================================
# Step 3: API Tests
# =============================================================================

log_section "Step 3: API Endpoint Tests"

# -----------------------------------------------------------------------------
# Test 3.1: Public Read (No Auth Required)
# -----------------------------------------------------------------------------

echo ""
log_info "Test 3.1: Public Read Operations (no authentication)"
echo ""

# GET /servers without token
RESPONSE=$(curl -k -s -w "\n%{http_code}" "${BACKSTAGE_URL}/api/mcp-entity-api/servers" 2>&1)
STATUS=$(echo "$RESPONSE" | tail -n1)
assert_http_status "GET /servers without token" "200" "$STATUS"

# GET /tools without token
RESPONSE=$(curl -k -s -w "\n%{http_code}" "${BACKSTAGE_URL}/api/mcp-entity-api/tools" 2>&1)
STATUS=$(echo "$RESPONSE" | tail -n1)
assert_http_status "GET /tools without token" "200" "$STATUS"

# GET /workloads without token
RESPONSE=$(curl -k -s -w "\n%{http_code}" "${BACKSTAGE_URL}/api/mcp-entity-api/workloads" 2>&1)
STATUS=$(echo "$RESPONSE" | tail -n1)
assert_http_status "GET /workloads without token" "200" "$STATUS"

# -----------------------------------------------------------------------------
# Test 3.2: Write Without Token (Should Fail 401)
# -----------------------------------------------------------------------------

echo ""
log_info "Test 3.2: Write Operations Without Token (expect 401)"
echo ""

# POST /servers without token
RESPONSE=$(curl -k -s -w "\n%{http_code}" -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/servers" \
    -H "Content-Type: application/json" \
    -d '{"metadata": {"name": "test"}, "spec": {"lifecycle": "experimental", "owner": "user:default/test", "mcp": {"connectionType": "stdio", "command": "test", "version": "1.0.0"}}}' 2>&1)
STATUS=$(echo "$RESPONSE" | tail -n1)
assert_http_status "POST /servers without token" "401" "$STATUS"

# POST /workloads without token
RESPONSE=$(curl -k -s -w "\n%{http_code}" -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/workloads" \
    -H "Content-Type: application/json" \
    -d '{"metadata": {"name": "test"}, "spec": {"lifecycle": "experimental", "owner": "user:default/test"}}' 2>&1)
STATUS=$(echo "$RESPONSE" | tail -n1)
assert_http_status "POST /workloads without token" "401" "$STATUS"

# -----------------------------------------------------------------------------
# Test 3.3: Create Server (Requires mcp-admin)
# -----------------------------------------------------------------------------

echo ""
log_info "Test 3.3: Create Server (requires mcp-admin role)"
echo ""

if [ "$HAS_MCP_ADMIN" = true ]; then
    EXPECTED_STATUS="201"
    log_info "You have mcp-admin role, expecting 201 Created"
else
    EXPECTED_STATUS="403"
    log_info "You do NOT have mcp-admin role, expecting 403 Forbidden"
fi

RESPONSE=$(curl -k -s -w "\n%{http_code}" -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/servers" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
        \"metadata\": {
            \"name\": \"${TEST_SERVER_NAME}\",
            \"namespace\": \"default\",
            \"title\": \"RBAC Test Server\"
        },
        \"spec\": {
            \"lifecycle\": \"experimental\",
            \"owner\": \"user:default/test\",
            \"mcp\": {
                \"connectionType\": \"stdio\",
                \"command\": \"node server.js\",
                \"version\": \"1.0.0\"
            }
        }
    }" 2>&1)

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

log_verbose "Response body: $BODY"

if [ "$STATUS" = "201" ]; then
    CREATED_ENTITIES+=("server:default:${TEST_SERVER_NAME}")
    log_info "Server created, will be cleaned up after tests"
fi

assert_http_status "POST /servers with token" "$EXPECTED_STATUS" "$STATUS"

# -----------------------------------------------------------------------------
# Test 3.4: Create Tools (Requires mcp-admin) - Create 2 tools for cascade delete test
# -----------------------------------------------------------------------------

echo ""
log_info "Test 3.4: Create Tools (requires mcp-admin role) - Creating 2 tools"
echo ""

if [ "$HAS_MCP_ADMIN" = true ]; then
    EXPECTED_STATUS="201"
    log_info "You have mcp-admin role, expecting 201 Created"
else
    EXPECTED_STATUS="403"
    log_info "You do NOT have mcp-admin role, expecting 403 Forbidden"
fi

# Create first tool
log_info "Creating first tool: ${TEST_TOOL_NAME_1}"
RESPONSE=$(curl -k -s -w "\n%{http_code}" -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/tools" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
        \"metadata\": {
            \"name\": \"${TEST_TOOL_NAME_1}\",
            \"namespace\": \"default\",
            \"title\": \"RBAC Test Tool 1\"
        },
        \"spec\": {
            \"lifecycle\": \"experimental\",
            \"owner\": \"user:default/test\",
            \"subcomponentOf\": \"component:default/${TEST_SERVER_NAME}\"
        }
    }" 2>&1)

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

log_verbose "Response body: $BODY"

if [ "$STATUS" = "201" ]; then
    CREATED_ENTITIES+=("tool:default:${TEST_TOOL_NAME_1}")
    log_info "Tool 1 created, will be cleaned up after tests"
fi

assert_http_status "POST /tools (tool 1) with token" "$EXPECTED_STATUS" "$STATUS"

# Create second tool (only if first succeeded and we have permission)
if [ "$STATUS" = "201" ] || [ "$EXPECTED_STATUS" = "403" ]; then
    log_info "Creating second tool: ${TEST_TOOL_NAME_2}"
    RESPONSE=$(curl -k -s -w "\n%{http_code}" -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/tools" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {
                \"name\": \"${TEST_TOOL_NAME_2}\",
                \"namespace\": \"default\",
                \"title\": \"RBAC Test Tool 2\"
            },
            \"spec\": {
                \"lifecycle\": \"experimental\",
                \"owner\": \"user:default/test\",
                \"subcomponentOf\": \"component:default/${TEST_SERVER_NAME}\"
            }
        }" 2>&1)

    STATUS=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n -1)

    log_verbose "Response body: $BODY"

    if [ "$STATUS" = "201" ]; then
        CREATED_ENTITIES+=("tool:default:${TEST_TOOL_NAME_2}")
        log_info "Tool 2 created, will be cleaned up after tests"
    fi

    assert_http_status "POST /tools (tool 2) with token" "$EXPECTED_STATUS" "$STATUS"
fi

# -----------------------------------------------------------------------------
# Test 3.5: Create Workload (Requires mcp-user)
# -----------------------------------------------------------------------------

echo ""
log_info "Test 3.5: Create Workload (requires mcp-user role)"
echo ""

if [ "$HAS_MCP_USER" = true ]; then
    EXPECTED_STATUS="201"
    log_info "You have mcp-user role, expecting 201 Created"
else
    EXPECTED_STATUS="403"
    log_info "You do NOT have mcp-user role, expecting 403 Forbidden"
fi

RESPONSE=$(curl -k -s -w "\n%{http_code}" -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/workloads" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
        \"metadata\": {
            \"name\": \"${TEST_WORKLOAD_NAME}\",
            \"namespace\": \"default\",
            \"title\": \"RBAC Test Workload\"
        },
        \"spec\": {
            \"lifecycle\": \"experimental\",
            \"owner\": \"user:default/test\"
        }
    }" 2>&1)

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

log_verbose "Response body: $BODY"

if [ "$STATUS" = "201" ]; then
    CREATED_ENTITIES+=("workload:default:${TEST_WORKLOAD_NAME}")
    log_info "Workload created, will be cleaned up after tests"
fi

assert_http_status "POST /workloads with token" "$EXPECTED_STATUS" "$STATUS"

# -----------------------------------------------------------------------------
# Test 3.6: Delete Operations (if entities were created)
# -----------------------------------------------------------------------------

echo ""
log_info "Test 3.6: Delete Operations (testing cascade delete)"
echo ""

if [ ${#CREATED_ENTITIES[@]} -eq 0 ]; then
    log_skip "No entities created, skipping delete tests"
    ((TESTS_SKIPPED+=4))
else
    # Check if we have the required permissions
    if [ "$HAS_MCP_ADMIN" = false ] && [ "$HAS_MCP_USER" = false ]; then
        log_skip "No permissions to delete, skipping delete tests"
        ((TESTS_SKIPPED+=4))
    else
        # Test cascade delete scenario:
        # 1. Delete tool 1 (should succeed)
        # 2. Delete server (should succeed and cascade delete tool 2)
        # 3. Try to delete tool 2 (should get 404 because it was cascade deleted)
        # 4. Delete workload (if created)
        
        # Step 1: Delete first tool
        if [[ " ${CREATED_ENTITIES[@]} " =~ " tool:default:${TEST_TOOL_NAME_1} " ]]; then
            if [ "$HAS_MCP_ADMIN" = true ]; then
                EXPECTED_STATUS="204"
            else
                EXPECTED_STATUS="403"
            fi
            
            log_info "Deleting tool 1: ${TEST_TOOL_NAME_1}"
            RESPONSE=$(curl -k -s -w "\n%{http_code}" -X DELETE \
                "${BACKSTAGE_URL}/api/mcp-entity-api/tools/default/${TEST_TOOL_NAME_1}" \
                -H "Authorization: Bearer ${TOKEN}" 2>&1)
            
            STATUS=$(echo "$RESPONSE" | tail -n1)
            assert_http_status "DELETE /tools/default/${TEST_TOOL_NAME_1}" "$EXPECTED_STATUS" "$STATUS"
            
            # Remove from cleanup list if successfully deleted
            if [ "$STATUS" = "204" ] || [ "$STATUS" = "404" ]; then
                CREATED_ENTITIES=("${CREATED_ENTITIES[@]/tool:default:${TEST_TOOL_NAME_1}}")
            fi
        fi
        
        # Step 2: Delete server (this will cascade delete tool 2)
        SERVER_DELETED_SUCCESSFULLY=false
        if [[ " ${CREATED_ENTITIES[@]} " =~ " server:default:${TEST_SERVER_NAME} " ]]; then
            if [ "$HAS_MCP_ADMIN" = true ]; then
                EXPECTED_STATUS="204"
            else
                EXPECTED_STATUS="403"
            fi
            
            log_info "Deleting server: ${TEST_SERVER_NAME} (will cascade delete tool 2)"
            RESPONSE=$(curl -k -s -w "\n%{http_code}" -X DELETE \
                "${BACKSTAGE_URL}/api/mcp-entity-api/servers/default/${TEST_SERVER_NAME}" \
                -H "Authorization: Bearer ${TOKEN}" 2>&1)
            
            STATUS=$(echo "$RESPONSE" | tail -n1)
            assert_http_status "DELETE /servers/default/${TEST_SERVER_NAME}" "$EXPECTED_STATUS" "$STATUS"
            
            # Track if server was successfully deleted
            if [ "$STATUS" = "204" ]; then
                SERVER_DELETED_SUCCESSFULLY=true
            fi
            
            # Remove from cleanup list if successfully deleted
            if [ "$STATUS" = "204" ] || [ "$STATUS" = "404" ]; then
                CREATED_ENTITIES=("${CREATED_ENTITIES[@]/server:default:${TEST_SERVER_NAME}}")
                # Also remove tool 2 since it was cascade deleted
                CREATED_ENTITIES=("${CREATED_ENTITIES[@]/tool:default:${TEST_TOOL_NAME_2}}")
            fi
        fi
        
        # Step 3: Try to delete tool 2
        # If server was successfully deleted, tool 2 should be cascade deleted (404)
        # Otherwise, check if tool 2 exists and handle based on permissions
        if [ "$SERVER_DELETED_SUCCESSFULLY" = true ]; then
            # Server was deleted, so tool 2 should be cascade deleted (404)
            log_info "Attempting to delete tool 2: ${TEST_TOOL_NAME_2} (expecting 404 due to cascade delete)"
            EXPECTED_STATUS="404"
        elif [[ " ${CREATED_ENTITIES[@]} " =~ " tool:default:${TEST_TOOL_NAME_2} " ]]; then
            # Tool 2 exists, delete it normally
            log_info "Deleting tool 2: ${TEST_TOOL_NAME_2}"
            if [ "$HAS_MCP_ADMIN" = true ]; then
                EXPECTED_STATUS="204"
            else
                EXPECTED_STATUS="403"
            fi
        else
            # Tool 2 was never created (no permission), expect 403
            log_info "Attempting to delete tool 2: ${TEST_TOOL_NAME_2} (never created, expecting 403)"
            EXPECTED_STATUS="403"
        fi
        
        RESPONSE=$(curl -k -s -w "\n%{http_code}" -X DELETE \
            "${BACKSTAGE_URL}/api/mcp-entity-api/tools/default/${TEST_TOOL_NAME_2}" \
            -H "Authorization: Bearer ${TOKEN}" 2>&1)
        
        STATUS=$(echo "$RESPONSE" | tail -n1)
        assert_http_status "DELETE /tools/default/${TEST_TOOL_NAME_2}" "$EXPECTED_STATUS" "$STATUS"
        
        # Remove from cleanup list if successfully deleted
        if [ "$STATUS" = "204" ] || [ "$STATUS" = "404" ]; then
            CREATED_ENTITIES=("${CREATED_ENTITIES[@]/tool:default:${TEST_TOOL_NAME_2}}")
        fi
        
        # Step 4: Delete workload (if created)
        if [[ " ${CREATED_ENTITIES[@]} " =~ " workload:default:${TEST_WORKLOAD_NAME} " ]]; then
            if [ "$HAS_MCP_USER" = true ]; then
                EXPECTED_STATUS="204"
            else
                EXPECTED_STATUS="403"
            fi
            
            log_info "Deleting workload: ${TEST_WORKLOAD_NAME}"
            RESPONSE=$(curl -k -s -w "\n%{http_code}" -X DELETE \
                "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/default/${TEST_WORKLOAD_NAME}" \
                -H "Authorization: Bearer ${TOKEN}" 2>&1)
            
            STATUS=$(echo "$RESPONSE" | tail -n1)
            assert_http_status "DELETE /workloads/default/${TEST_WORKLOAD_NAME}" "$EXPECTED_STATUS" "$STATUS"
            
            # Remove from cleanup list if successfully deleted
            if [ "$STATUS" = "204" ] || [ "$STATUS" = "404" ]; then
                CREATED_ENTITIES=("${CREATED_ENTITIES[@]/workload:default:${TEST_WORKLOAD_NAME}}")
            fi
        fi
        
        # Filter out empty entries
        CREATED_ENTITIES=(${CREATED_ENTITIES[@]})
    fi
fi

# =============================================================================
# Test Summary
# =============================================================================

log_section "Test Summary"

echo ""
echo -e "  ${GREEN}Passed:${NC}  $TESTS_PASSED"
echo -e "  ${RED}Failed:${NC}  $TESTS_FAILED"
echo -e "  ${CYAN}Skipped:${NC} $TESTS_SKIPPED"
echo ""

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ALL TESTS PASSED                                             ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    EXIT_CODE=0
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  SOME TESTS FAILED                                            ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
    EXIT_CODE=1
fi

echo ""

# Cleanup will be called by trap on exit
exit $EXIT_CODE
