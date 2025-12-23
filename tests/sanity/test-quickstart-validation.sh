#!/bin/bash
#
# Quickstart Validation Test Script
# 
# Validates the scenarios described in specs/003-entity-management-api/quickstart.md
# against the deployed API.
#
# Usage: ./test-quickstart-validation.sh [--skip-cleanup] [--verbose]
#

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Test entity names (will be cleaned up)
TEST_SERVER_NAME="github-mcp-server"
TEST_TOOL_NAME="create-issue"
TEST_WORKLOAD_NAME="bug-triage-workflow"

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

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
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
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# =============================================================================
# Cleanup Function
# =============================================================================

cleanup() {
    if [ "$SKIP_CLEANUP" = true ]; then
        log_warn "Skipping cleanup (--skip-cleanup specified)"
        return 0
    fi

    log_section "Cleanup"
    
    # Filter out empty elements from CREATED_ENTITIES array
    local filtered_entities=()
    for entity in "${CREATED_ENTITIES[@]}"; do
        if [ -n "$entity" ] && [[ "$entity" =~ : ]]; then
            filtered_entities+=("$entity")
        fi
    done
    
    if [ ${#filtered_entities[@]} -eq 0 ]; then
        log_info "No entities to clean up"
        return 0
    fi
    
    # Delete in reverse order: workload -> tool -> server
    for entity in "${filtered_entities[@]}"; do
        IFS=':' read -r entity_type namespace name <<< "$entity"
        
        # Skip if parsing failed
        if [ -z "$entity_type" ] || [ -z "$namespace" ] || [ -z "$name" ]; then
            log_warn "Skipping invalid entity entry: $entity"
            continue
        fi
        
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
        fi
    done
}

trap cleanup EXIT

# =============================================================================
# Prerequisites Check
# =============================================================================

log_section "Prerequisites Check"

# Check oc CLI
if ! command -v oc &> /dev/null; then
    log_fail "oc CLI not found"
    exit 1
fi
log_success "oc CLI found"

# Check oc login
if ! oc whoami &> /dev/null; then
    log_fail "Not logged in to OpenShift"
    exit 1
fi
CURRENT_USER=$(oc whoami)
log_success "Logged in as: $CURRENT_USER"

# Get Backstage URL
if [ -n "${BACKSTAGE_URL:-}" ]; then
    log_info "Using Backstage URL from environment: $BACKSTAGE_URL"
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

# Get token
TOKEN=$(oc whoami -t)
if [ -z "$TOKEN" ]; then
    log_fail "Could not get authentication token"
    exit 1
fi
log_success "Authentication token obtained"

# Check for mcp-admin role (required for quickstart scenarios)
log_info "Checking for mcp-admin role..."
CAN_CREATE_SERVER=$(oc auth can-i create mcpservers.mcp-catalog.io 2>/dev/null)
if [ "$CAN_CREATE_SERVER" != "yes" ]; then
    log_fail "User '$CURRENT_USER' does not have mcp-admin role"
    echo ""
    echo -e "${YELLOW}This script requires mcp-admin role to create and manage MCP entities.${NC}"
    echo ""
    echo -e "${YELLOW}To grant mcp-admin role to your user, run as admin:${NC}"
    echo "  oc create clusterrolebinding mcp-admin-${CURRENT_USER} \\"
    echo "    --clusterrole=mcp-admin \\"
    echo "    --user=${CURRENT_USER}"
    echo ""
    echo -e "${YELLOW}Or check your current permissions:${NC}"
    echo "  oc auth can-i create mcpservers.mcp-catalog.io"
    echo "  oc auth can-i create mcptools.mcp-catalog.io"
    echo ""
    exit 1
fi
log_success "User has mcp-admin role (can create servers and tools)"

# =============================================================================
# Quickstart Validation Scenarios
# =============================================================================

log_section "Quickstart Validation Scenarios"

# -----------------------------------------------------------------------------
# Scenario 1: Create an MCP Server
# -----------------------------------------------------------------------------

log_info "Scenario 1: Create an MCP Server"

RESPONSE=$(curl -k -s -w "\n%{http_code}" -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/servers" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
        \"metadata\": {
            \"name\": \"${TEST_SERVER_NAME}\",
            \"namespace\": \"default\",
            \"title\": \"GitHub MCP Server\",
            \"description\": \"Provides GitHub API tools\"
        },
        \"spec\": {
            \"lifecycle\": \"production\",
            \"owner\": \"user:default/jsmith\",
            \"mcp\": {
                \"connectionType\": \"stdio\",
                \"command\": \"npx\",
                \"version\": \"1.0.0\"
            }
        }
    }" 2>&1)

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

log_verbose "Response status: $STATUS"
log_verbose "Response body: $BODY"

if [ "$STATUS" = "201" ]; then
    CREATED_ENTITIES+=("server:default:${TEST_SERVER_NAME}")
    log_success "Created MCP Server (expected 201, got $STATUS)"
    
    # Verify response structure
    if echo "$BODY" | jq -e '.metadata.name == "'"${TEST_SERVER_NAME}"'"' > /dev/null 2>&1; then
        log_success "Response contains correct entity name"
    else
        log_fail "Response does not contain expected entity name"
    fi
else
    log_fail "Create Server failed (expected 201, got $STATUS)"
fi

# -----------------------------------------------------------------------------
# Scenario 2: Create an MCP Tool
# -----------------------------------------------------------------------------

log_info "Scenario 2: Create an MCP Tool"

RESPONSE=$(curl -k -s -w "\n%{http_code}" -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/tools" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
        \"metadata\": {
            \"name\": \"${TEST_TOOL_NAME}\",
            \"namespace\": \"default\",
            \"title\": \"Create GitHub Issue\",
            \"description\": \"Creates a new issue in a GitHub repository\"
        },
        \"spec\": {
            \"lifecycle\": \"production\",
            \"owner\": \"user:default/jsmith\",
            \"subcomponentOf\": \"component:default/${TEST_SERVER_NAME}\"
        }
    }" 2>&1)

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

log_verbose "Response status: $STATUS"
log_verbose "Response body: $BODY"

if [ "$STATUS" = "201" ]; then
    CREATED_ENTITIES+=("tool:default:${TEST_TOOL_NAME}")
    log_success "Created MCP Tool (expected 201, got $STATUS)"
else
    log_fail "Create Tool failed (expected 201, got $STATUS)"
fi

# -----------------------------------------------------------------------------
# Scenario 3: Create an MCP Workload
# -----------------------------------------------------------------------------

log_info "Scenario 3: Create an MCP Workload"

RESPONSE=$(curl -k -s -w "\n%{http_code}" -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/workloads" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
        \"metadata\": {
            \"name\": \"${TEST_WORKLOAD_NAME}\",
            \"namespace\": \"default\",
            \"title\": \"Bug Triage Workflow\",
            \"description\": \"Automated bug triage using GitHub tools\"
        },
        \"spec\": {
            \"lifecycle\": \"production\",
            \"owner\": \"user:default/jsmith\",
            \"dependsOn\": [
                \"component:default/${TEST_TOOL_NAME}\"
            ]
        }
    }" 2>&1)

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

log_verbose "Response status: $STATUS"
log_verbose "Response body: $BODY"

if [ "$STATUS" = "201" ]; then
    CREATED_ENTITIES+=("workload:default:${TEST_WORKLOAD_NAME}")
    log_success "Created MCP Workload (expected 201, got $STATUS)"
else
    log_fail "Create Workload failed (expected 201, got $STATUS)"
fi

# -----------------------------------------------------------------------------
# Scenario 4: List Entities
# -----------------------------------------------------------------------------

log_info "Scenario 4: List Entities"

# List servers (with retry for catalog visibility)
log_info "Listing servers (checking if created server appears)..."
SERVER_FOUND=false
MAX_RETRIES=5
RETRY_COUNT=0
STATUS=""

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    RESPONSE=$(curl -k -s -w "\n%{http_code}" "${BACKSTAGE_URL}/api/mcp-entity-api/servers" 2>&1)
    STATUS=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n -1)
    
    if [ "$STATUS" = "200" ]; then
        # Check if response is an array or has items property
        if echo "$BODY" | jq -e '.items[]? | select(.metadata.name == "'"${TEST_SERVER_NAME}"'")' > /dev/null 2>&1 || \
           echo "$BODY" | jq -e '.[]? | select(.metadata.name == "'"${TEST_SERVER_NAME}"'")' > /dev/null 2>&1; then
            SERVER_FOUND=true
            break
        fi
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        log_verbose "Server not yet visible, retrying... (${RETRY_COUNT}/${MAX_RETRIES})"
        sleep 1
    fi
done

if [ "$STATUS" = "200" ]; then
    log_success "List Servers (expected 200, got $STATUS)"
    if [ "$SERVER_FOUND" = true ]; then
        log_success "Created server appears in list (after ${RETRY_COUNT} attempt(s))"
    else
        log_fail "Created server not found in list after ${MAX_RETRIES} attempts"
    fi
else
    log_fail "List Servers failed (expected 200, got $STATUS)"
fi

# List tools
RESPONSE=$(curl -k -s -w "\n%{http_code}" "${BACKSTAGE_URL}/api/mcp-entity-api/tools" 2>&1)
STATUS=$(echo "$RESPONSE" | tail -n1)

if [ "$STATUS" = "200" ]; then
    log_success "List Tools (expected 200, got $STATUS)"
else
    log_fail "List Tools failed (expected 200, got $STATUS)"
fi

# List workloads
RESPONSE=$(curl -k -s -w "\n%{http_code}" "${BACKSTAGE_URL}/api/mcp-entity-api/workloads" 2>&1)
STATUS=$(echo "$RESPONSE" | tail -n1)

if [ "$STATUS" = "200" ]; then
    log_success "List Workloads (expected 200, got $STATUS)"
else
    log_fail "List Workloads failed (expected 200, got $STATUS)"
fi

# -----------------------------------------------------------------------------
# Scenario 5: Get a Specific Entity
# -----------------------------------------------------------------------------

log_info "Scenario 5: Get a Specific Entity"

RESPONSE=$(curl -k -s -w "\n%{http_code}" "${BACKSTAGE_URL}/api/mcp-entity-api/servers/default/${TEST_SERVER_NAME}" \
    -H "Authorization: Bearer ${TOKEN}" 2>&1)
STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$STATUS" = "200" ]; then
    log_success "Get Server (expected 200, got $STATUS)"
    if echo "$BODY" | jq -e '.metadata.name == "'"${TEST_SERVER_NAME}"'"' > /dev/null 2>&1; then
        log_success "Retrieved entity matches created entity"
    else
        log_fail "Retrieved entity does not match"
    fi
else
    log_fail "Get Server failed (expected 200, got $STATUS)"
fi

# -----------------------------------------------------------------------------
# Scenario 6: Update an Entity
# -----------------------------------------------------------------------------

log_info "Scenario 6: Update an Entity"

RESPONSE=$(curl -k -s -w "\n%{http_code}" -X PUT "${BACKSTAGE_URL}/api/mcp-entity-api/servers/default/${TEST_SERVER_NAME}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
        \"metadata\": {
            \"name\": \"${TEST_SERVER_NAME}\",
            \"namespace\": \"default\",
            \"title\": \"GitHub MCP Server (Updated)\",
            \"description\": \"Updated description\"
        },
        \"spec\": {
            \"lifecycle\": \"production\",
            \"owner\": \"user:default/jsmith\",
            \"mcp\": {
                \"connectionType\": \"stdio\",
                \"command\": \"npx\",
                \"version\": \"1.1.0\"
            }
        }
    }" 2>&1)

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

log_verbose "Response status: $STATUS"
log_verbose "Response body: $BODY"

if [ "$STATUS" = "200" ]; then
    log_success "Update Server (expected 200, got $STATUS)"
    if echo "$BODY" | jq -e '.metadata.title == "GitHub MCP Server (Updated)"' > /dev/null 2>&1; then
        log_success "Entity was updated correctly"
    else
        log_fail "Entity update did not persist"
    fi
else
    log_fail "Update Server failed (expected 200, got $STATUS)"
fi

# -----------------------------------------------------------------------------
# Scenario 7: Delete Entities (cascade test)
# -----------------------------------------------------------------------------

log_info "Scenario 7: Delete Entities (testing cascade delete)"

# Helper function to remove entity from CREATED_ENTITIES array
remove_entity() {
    local entity_to_remove="$1"
    local new_array=()
    for entity in "${CREATED_ENTITIES[@]}"; do
        if [ "$entity" != "$entity_to_remove" ]; then
            new_array+=("$entity")
        fi
    done
    CREATED_ENTITIES=("${new_array[@]}")
}

# Delete tool first
RESPONSE=$(curl -k -s -w "\n%{http_code}" -X DELETE \
    "${BACKSTAGE_URL}/api/mcp-entity-api/tools/default/${TEST_TOOL_NAME}" \
    -H "Authorization: Bearer ${TOKEN}" 2>&1)
STATUS=$(echo "$RESPONSE" | tail -n1)

if [ "$STATUS" = "204" ]; then
    log_success "Delete Tool (expected 204, got $STATUS)"
    remove_entity "tool:default:${TEST_TOOL_NAME}"
else
    log_fail "Delete Tool failed (expected 204, got $STATUS)"
fi

# Delete workload
RESPONSE=$(curl -k -s -w "\n%{http_code}" -X DELETE \
    "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/default/${TEST_WORKLOAD_NAME}" \
    -H "Authorization: Bearer ${TOKEN}" 2>&1)
STATUS=$(echo "$RESPONSE" | tail -n1)

if [ "$STATUS" = "204" ]; then
    log_success "Delete Workload (expected 204, got $STATUS)"
    remove_entity "workload:default:${TEST_WORKLOAD_NAME}"
else
    log_fail "Delete Workload failed (expected 204, got $STATUS)"
fi

# Delete server (should cascade delete any remaining tools)
RESPONSE=$(curl -k -s -w "\n%{http_code}" -X DELETE \
    "${BACKSTAGE_URL}/api/mcp-entity-api/servers/default/${TEST_SERVER_NAME}" \
    -H "Authorization: Bearer ${TOKEN}" 2>&1)
STATUS=$(echo "$RESPONSE" | tail -n1)

if [ "$STATUS" = "204" ]; then
    log_success "Delete Server (expected 204, got $STATUS)"
    remove_entity "server:default:${TEST_SERVER_NAME}"
else
    log_fail "Delete Server failed (expected 204, got $STATUS)"
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
    echo -e "${GREEN}║  ALL QUICKSTART VALIDATION TESTS PASSED                      ║${NC}"
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
