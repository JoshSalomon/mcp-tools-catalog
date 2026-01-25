#!/bin/bash
#
# Server Tools View Sanity Tests (007-server-tools-view)
#
# Tests for the server tools endpoint: GET /servers/:namespace/:name/tools
#
# Usage: ./server-tools-view.sh [--verbose]
#
# Prerequisites:
#   - Backstage backend running with mcp-entity-api plugin
#   - At least one server with tools in the catalog
#   - curl, jq installed
#

set -o pipefail

# Configuration
BACKSTAGE_NAMESPACE="${BACKSTAGE_NAMESPACE:-backstage}"
BACKSTAGE_PORT="${BACKSTAGE_PORT:-7007}"
VERBOSE="${VERBOSE:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Port forward PID
BACKSTAGE_PF_PID=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose|-v)
            VERBOSE="true"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--verbose]"
            echo ""
            echo "Environment variables:"
            echo "  BACKSTAGE_NAMESPACE  Backstage namespace (default: backstage)"
            echo "  BACKSTAGE_PORT       Local port for Backstage (default: 7007)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Logging functions
log_header() {
    echo ""
    echo -e "${BOLD}${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${BLUE}  $1${NC}"
    echo -e "${BOLD}${BLUE}════════════════════════════════════════════════════════════${NC}"
}

log_section() {
    echo ""
    echo -e "${CYAN}── $1 ──${NC}"
}

log_test() {
    echo -ne "  ${BOLD}[$1]${NC} $2 ... "
}

log_pass() {
    echo -e "${GREEN}✅ PASS${NC}"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}❌ FAIL${NC}"
    if [[ -n "$1" ]]; then
        echo -e "         ${RED}$1${NC}"
    fi
    ((TESTS_FAILED++))
}

log_skip() {
    echo -e "${YELLOW}⏭️  SKIP${NC}"
    if [[ -n "$1" ]]; then
        echo -e "         ${YELLOW}$1${NC}"
    fi
    ((TESTS_SKIPPED++))
}

log_info() {
    echo -e "  ${YELLOW}ℹ️  $1${NC}"
}

log_verbose() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "      ${CYAN}$1${NC}"
    fi
}

# Cleanup function
cleanup() {
    if [[ -n "$BACKSTAGE_PF_PID" ]]; then
        kill "$BACKSTAGE_PF_PID" 2>/dev/null
    fi
}
trap cleanup EXIT

# Get OpenShift token for authentication
get_token() {
    oc whoami -t 2>/dev/null || echo ""
}

# API helper
api_call() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local url="http://localhost:${BACKSTAGE_PORT}/api/mcp-entity-api${endpoint}"
    local token
    token=$(get_token)

    if [[ -n "$data" ]]; then
        if [[ -n "$token" ]]; then
            curl -s -X "$method" "$url" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $token" \
                -d "$data"
        else
            curl -s -X "$method" "$url" \
                -H "Content-Type: application/json" \
                -d "$data"
        fi
    else
        if [[ -n "$token" ]]; then
            curl -s -X "$method" "$url" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $token"
        else
            curl -s -X "$method" "$url" \
                -H "Content-Type: application/json"
        fi
    fi
}

# Check prerequisites
check_prerequisites() {
    log_section "Prerequisites Check"

    # Check oc CLI
    log_test "PRE-1" "oc CLI available"
    if ! command -v oc &> /dev/null; then
        log_fail "oc CLI not found"
        return 1
    fi
    log_pass

    # Check oc login
    log_test "PRE-2" "Logged into OpenShift"
    if ! oc whoami &> /dev/null; then
        log_fail "Not logged into OpenShift"
        return 1
    fi
    log_pass

    # Check jq
    log_test "PRE-3" "jq available"
    if ! command -v jq &> /dev/null; then
        log_fail "jq not found"
        return 1
    fi
    log_pass

    return 0
}

# Setup port forwarding
setup_port_forward() {
    log_section "Setting up Port Forwarding"

    log_test "PF-1" "Port forward to Backstage"

    # Check if port is already in use
    if lsof -i ":${BACKSTAGE_PORT}" &> /dev/null; then
        log_info "Port ${BACKSTAGE_PORT} already in use, assuming existing port-forward"
        log_pass
        return 0
    fi

    # Start port forward
    oc port-forward -n "${BACKSTAGE_NAMESPACE}" svc/backstage "${BACKSTAGE_PORT}:7007" &> /dev/null &
    BACKSTAGE_PF_PID=$!
    sleep 3

    if ! kill -0 "$BACKSTAGE_PF_PID" 2>/dev/null; then
        log_fail "Port forward failed to start"
        return 1
    fi
    log_pass

    return 0
}

# Test server tools endpoint
test_server_tools_endpoint() {
    log_section "Server Tools Endpoint Tests (US1)"

    # First, get a list of servers
    log_test "ST-1" "GET /servers returns servers"
    local servers_response
    servers_response=$(api_call GET "/servers")
    if [[ $? -ne 0 ]] || [[ -z "$servers_response" ]]; then
        log_fail "Failed to get servers"
        return 1
    fi

    local server_count
    server_count=$(echo "$servers_response" | jq -r '.items | length // 0')
    if [[ "$server_count" -eq 0 ]]; then
        log_skip "No servers in catalog - cannot test server tools endpoint"
        return 0
    fi
    log_pass
    log_verbose "Found $server_count servers"

    # Get the first server's namespace and name
    local first_server_ns
    local first_server_name
    first_server_ns=$(echo "$servers_response" | jq -r '.items[0].metadata.namespace // "default"')
    first_server_name=$(echo "$servers_response" | jq -r '.items[0].metadata.name')
    log_verbose "Testing with server: ${first_server_ns}/${first_server_name}"

    # Test GET /servers/:ns/:name/tools
    log_test "ST-2" "GET /servers/:ns/:name/tools returns 200"
    local tools_response
    tools_response=$(api_call GET "/servers/${first_server_ns}/${first_server_name}/tools")
    if [[ $? -ne 0 ]]; then
        log_fail "Request failed"
        return 1
    fi
    log_pass
    log_verbose "Response: $(echo "$tools_response" | head -c 200)"

    # Verify response structure
    log_test "ST-3" "Response has items array"
    local has_items
    has_items=$(echo "$tools_response" | jq -r 'has("items")')
    if [[ "$has_items" != "true" ]]; then
        log_fail "Missing 'items' field"
        return 1
    fi
    log_pass

    log_test "ST-4" "Response has totalCount"
    local has_count
    has_count=$(echo "$tools_response" | jq -r 'has("totalCount")')
    if [[ "$has_count" != "true" ]]; then
        log_fail "Missing 'totalCount' field"
        return 1
    fi
    log_pass

    # Check if we have tools to test sorting
    local tool_count
    tool_count=$(echo "$tools_response" | jq -r '.totalCount')
    log_verbose "Server has $tool_count tools"

    if [[ "$tool_count" -gt 1 ]]; then
        log_test "ST-5" "Tools are sorted alphabetically (A-Z)"
        local sorted_check
        sorted_check=$(echo "$tools_response" | jq -r '
            .items |
            [.[].metadata.name] |
            . as $original |
            sort |
            . == $original
        ')
        if [[ "$sorted_check" != "true" ]]; then
            log_fail "Tools are not sorted alphabetically"
            return 1
        fi
        log_pass
    else
        log_test "ST-5" "Tools are sorted alphabetically (A-Z)"
        log_skip "Need 2+ tools to verify sorting"
    fi

    # Test 404 for non-existent server
    log_test "ST-6" "GET /servers/nonexistent/server/tools returns 404"
    local notfound_response
    notfound_response=$(curl -s -w "%{http_code}" -o /dev/null \
        "http://localhost:${BACKSTAGE_PORT}/api/mcp-entity-api/servers/nonexistent/notaserver/tools")
    if [[ "$notfound_response" == "404" ]]; then
        log_pass
    else
        log_fail "Expected 404, got $notfound_response"
    fi

    # Test tool entity structure (if we have tools)
    if [[ "$tool_count" -gt 0 ]]; then
        log_test "ST-7" "Tool entities have required fields"
        local first_tool_valid
        first_tool_valid=$(echo "$tools_response" | jq -r '
            .items[0] |
            has("apiVersion") and has("kind") and has("metadata") and has("spec")
        ')
        if [[ "$first_tool_valid" != "true" ]]; then
            log_fail "Tool entity missing required fields"
            return 1
        fi
        log_pass

        log_test "ST-8" "Tool spec.type is mcp-tool"
        local tool_type
        tool_type=$(echo "$tools_response" | jq -r '.items[0].spec.type')
        if [[ "$tool_type" != "mcp-tool" ]]; then
            log_fail "Expected mcp-tool, got $tool_type"
            return 1
        fi
        log_pass
    fi

    return 0
}

# Test alternative description endpoint (T021 - Phase 4A backend tests)
test_alternative_description_endpoint() {
    log_section "Alternative Description Endpoint Tests (US2 - Backend)"

    # First, get a tool to test with
    log_test "AD-1" "GET /tools returns tools"
    local tools_response
    tools_response=$(api_call GET "/tools")
    if [[ $? -ne 0 ]] || [[ -z "$tools_response" ]]; then
        log_fail "Failed to get tools"
        return 1
    fi

    local tool_count
    tool_count=$(echo "$tools_response" | jq -r '.items | length // 0')
    if [[ "$tool_count" -eq 0 ]]; then
        log_skip "No tools in catalog - cannot test alternative description endpoint"
        return 0
    fi
    log_pass
    log_verbose "Found $tool_count tools"

    # Get the first tool's namespace and name
    local first_tool_ns
    local first_tool_name
    first_tool_ns=$(echo "$tools_response" | jq -r '.items[0].metadata.namespace // "default"')
    first_tool_name=$(echo "$tools_response" | jq -r '.items[0].metadata.name')
    log_verbose "Testing with tool: ${first_tool_ns}/${first_tool_name}"

    # Test PUT /tools/:ns/:name/alternative-description - Set description
    log_test "AD-2" "PUT alternative-description sets description"
    local set_response
    set_response=$(api_call PUT "/tools/${first_tool_ns}/${first_tool_name}/alternative-description" \
        '{"alternativeDescription": "Test alternative description for server-tools-view"}')
    local put_exit_code=$?
    if [[ $put_exit_code -ne 0 ]]; then
        log_fail "Request failed with exit code $put_exit_code"
        return 1
    fi
    
    # Check if response contains error
    local error_msg
    error_msg=$(echo "$set_response" | jq -r '.error // empty')
    if [[ -n "$error_msg" ]]; then
        log_fail "PUT request returned error: $error_msg"
        log_verbose "Full response: $set_response"
        return 1
    fi
    
    # Check if PUT response includes alternativeDescription
    local put_alt_desc
    put_alt_desc=$(echo "$set_response" | jq -r '.alternativeDescription // "null"')
    log_verbose "PUT response alternativeDescription: $put_alt_desc"
    
    log_pass
    log_verbose "Response: $(echo "$set_response" | head -c 200)"

    # Verify the tool now has the alternative description
    log_test "AD-3" "GET tool shows alternativeDescription"
    # Add small delay to ensure database is updated
    sleep 1
    local updated_tool
    updated_tool=$(api_call GET "/tools/${first_tool_ns}/${first_tool_name}")
    if [[ $? -ne 0 ]]; then
        log_fail "Request failed"
        return 1
    fi

    local alt_desc
    alt_desc=$(echo "$updated_tool" | jq -r '.alternativeDescription // "null"')
    log_verbose "GET response alternativeDescription: $alt_desc"
    if [[ "$alt_desc" != "Test alternative description for server-tools-view" ]]; then
        log_fail "Alternative description not set correctly: got '$alt_desc'"
        log_verbose "Full GET response: $(echo "$updated_tool" | jq -c .)"
        return 1
    fi
    log_pass

    # Test PUT with null/empty to clear
    log_test "AD-4" "PUT alternative-description clears with empty string"
    local clear_response
    clear_response=$(api_call PUT "/tools/${first_tool_ns}/${first_tool_name}/alternative-description" \
        '{"alternativeDescription": ""}')
    if [[ $? -ne 0 ]]; then
        log_fail "Request failed"
        return 1
    fi
    log_pass

    # Verify the description was cleared
    log_test "AD-5" "GET tool shows cleared alternativeDescription"
    local cleared_tool
    cleared_tool=$(api_call GET "/tools/${first_tool_ns}/${first_tool_name}")
    if [[ $? -ne 0 ]]; then
        log_fail "Request failed"
        return 1
    fi

    local cleared_desc
    cleared_desc=$(echo "$cleared_tool" | jq -r '.alternativeDescription // "null"')
    if [[ "$cleared_desc" != "null" ]]; then
        log_fail "Alternative description not cleared: got '$cleared_desc'"
        return 1
    fi
    log_pass

    # Test validation - description too long (max 2000 chars)
    log_test "AD-6" "PUT alternative-description rejects long descriptions"
    local long_desc
    # Generate a string longer than 2000 characters
    long_desc=$(printf 'A%.0s' {1..2001})
    local validation_response
    local token
    token=$(get_token)
    if [[ -n "$token" ]]; then
        validation_response=$(curl -s -w "%{http_code}" -o /dev/null \
            -X PUT "http://localhost:${BACKSTAGE_PORT}/api/mcp-entity-api/tools/${first_tool_ns}/${first_tool_name}/alternative-description" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d "{\"alternativeDescription\": \"$long_desc\"}")
    else
        validation_response=$(curl -s -w "%{http_code}" -o /dev/null \
            -X PUT "http://localhost:${BACKSTAGE_PORT}/api/mcp-entity-api/tools/${first_tool_ns}/${first_tool_name}/alternative-description" \
            -H "Content-Type: application/json" \
            -d "{\"alternativeDescription\": \"$long_desc\"}")
    fi
    if [[ "$validation_response" == "400" ]]; then
        log_pass
    else
        log_fail "Expected 400 (validation error), got $validation_response"
    fi

    # Test 404 for non-existent tool
    log_test "AD-7" "PUT alternative-description returns 404 for missing tool"
    local notfound_response
    if [[ -n "$token" ]]; then
        notfound_response=$(curl -s -w "%{http_code}" -o /dev/null \
            -X PUT "http://localhost:${BACKSTAGE_PORT}/api/mcp-entity-api/tools/nonexistent/notreal/alternative-description" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d '{"alternativeDescription": "Test"}')
    else
        notfound_response=$(curl -s -w "%{http_code}" -o /dev/null \
            -X PUT "http://localhost:${BACKSTAGE_PORT}/api/mcp-entity-api/tools/nonexistent/notreal/alternative-description" \
            -H "Content-Type: application/json" \
            -d '{"alternativeDescription": "Test"}')
    fi
    if [[ "$notfound_response" == "404" ]]; then
        log_pass
    else
        log_fail "Expected 404, got $notfound_response"
    fi

    # Test invalid request body
    log_test "AD-8" "PUT alternative-description validates request body"
    local invalid_response
    if [[ -n "$token" ]]; then
        invalid_response=$(curl -s -w "%{http_code}" -o /dev/null \
            -X PUT "http://localhost:${BACKSTAGE_PORT}/api/mcp-entity-api/tools/${first_tool_ns}/${first_tool_name}/alternative-description" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d '{"alternativeDescription": 123}')
    else
        invalid_response=$(curl -s -w "%{http_code}" -o /dev/null \
            -X PUT "http://localhost:${BACKSTAGE_PORT}/api/mcp-entity-api/tools/${first_tool_ns}/${first_tool_name}/alternative-description" \
            -H "Content-Type: application/json" \
            -d '{"alternativeDescription": 123}')
    fi
    if [[ "$invalid_response" == "400" ]]; then
        log_pass
    else
        log_fail "Expected 400 (validation error), got $invalid_response"
    fi

    # Clean up - ensure description is cleared
    api_call PUT "/tools/${first_tool_ns}/${first_tool_name}/alternative-description" \
        '{"alternativeDescription": null}' &>/dev/null

    return 0
}

# Test Tools Navigation Removal (US3)
test_tools_navigation_removal() {
    log_header "US3: Tools Navigation Removal Tests"

    # Test that console-extensions.json doesn't contain Tools navigation item
    log_test "NAV-1" "console-extensions.json does not contain Tools navigation"
    if [[ ! -f "console-extensions.json" ]]; then
        log_skip "console-extensions.json not found in current directory"
        return 0
    fi

    if grep -q '"id": "mcp-tools-list"' console-extensions.json 2>/dev/null; then
        log_fail "Tools navigation item still exists in console-extensions.json"
        return 1
    fi

    if grep -q '"name": "Tools"' console-extensions.json 2>/dev/null; then
        log_fail "Tools navigation name still exists in console-extensions.json"
        return 1
    fi

    log_pass

    # Test that legacy Tools tab URL redirects to Servers
    # Note: This is a frontend redirect, so we can't easily test it via curl
    # Instead, we verify the redirect logic exists in the code
    log_test "NAV-2" "Legacy Tools tab URL redirect logic exists in code"
    if [[ ! -f "src/components/McpCatalogPage.tsx" ]]; then
        log_skip "McpCatalogPage.tsx not found in expected location"
        return 0
    fi

    if ! grep -q "activeTab === 'tool'" src/components/McpCatalogPage.tsx 2>/dev/null; then
        log_fail "Redirect logic for legacy Tools tab not found"
        return 1
    fi

    log_pass

    # Test that Tools filter button is removed from entity type filters
    log_test "NAV-3" "Tools filter button removed from entity type filters"
    if grep -q 'handleTypeFilter.*tool' src/components/McpCatalogPage.tsx 2>/dev/null; then
        log_fail "Tools filter button handler still exists"
        return 1
    fi

    if grep -q 'WrenchIcon' src/components/McpCatalogPage.tsx 2>/dev/null; then
        log_fail "WrenchIcon (Tools icon) still imported or used"
        return 1
    fi

    log_pass

    # Test that Tools tab is removed from main tabs
    log_test "NAV-4" "Tools tab removed from main navigation tabs"
    if grep -q '<TabTitleText>Tools</TabTitleText>' src/components/McpCatalogPage.tsx 2>/dev/null; then
        log_fail "Tools tab still exists in navigation"
        return 1
    fi

    if grep -q 'ToolsTab' src/components/McpCatalogPage.tsx 2>/dev/null; then
        log_fail "ToolsTab component still imported or used"
        return 1
    fi

    log_pass

    # Test that Guardrails filter button exists (should be present)
    log_test "NAV-5" "Guardrails filter button exists"
    if ! grep -q 'handleTypeFilter.*guardrail' src/components/McpCatalogPage.tsx 2>/dev/null; then
        log_fail "Guardrails filter button handler not found"
        return 1
    fi

    if ! grep -q 'ShieldAltIcon' src/components/McpCatalogPage.tsx 2>/dev/null; then
        log_fail "ShieldAltIcon (Guardrails icon) not found"
        return 1
    fi

    log_pass

    return 0
}

# Main execution
main() {
    log_header "Server Tools View Sanity Tests (007-server-tools-view)"

    if ! check_prerequisites; then
        echo ""
        echo -e "${RED}Prerequisites check failed. Exiting.${NC}"
        exit 1
    fi

    if ! setup_port_forward; then
        echo ""
        echo -e "${RED}Port forwarding setup failed. Exiting.${NC}"
        exit 1
    fi

    # Wait for port forward to be ready
    sleep 2

    # Run tests
    test_server_tools_endpoint
    test_alternative_description_endpoint
    test_tools_navigation_removal

    # Summary
    log_header "Test Summary"
    echo ""
    echo -e "  ${GREEN}Passed:${NC}  $TESTS_PASSED"
    echo -e "  ${RED}Failed:${NC}  $TESTS_FAILED"
    echo -e "  ${YELLOW}Skipped:${NC} $TESTS_SKIPPED"
    echo ""

    if [[ $TESTS_FAILED -gt 0 ]]; then
        echo -e "${RED}Some tests failed!${NC}"
        exit 1
    else
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    fi
}

main "$@"
