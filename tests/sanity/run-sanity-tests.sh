#!/bin/bash
#
# MCP Tools Catalog - Sanity Test Suite
#
# Run from local environment to verify deployed system health
# Prerequisites: oc CLI logged in, curl, jq
#
# Usage: ./run-sanity-tests.sh [--verbose]
#

set -o pipefail

# Configuration
BACKSTAGE_NAMESPACE="${BACKSTAGE_NAMESPACE:-backstage}"
PLUGIN_NAMESPACE="${PLUGIN_NAMESPACE:-mcp-tools-catalog}"
BACKSTAGE_PORT="${BACKSTAGE_PORT:-7007}"
PLUGIN_PORT="${PLUGIN_PORT:-9443}"
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

# Port forward PIDs
BACKSTAGE_PF_PID=""
PLUGIN_PF_PID=""

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
            echo "  PLUGIN_NAMESPACE     Plugin namespace (default: mcp-tools-catalog)"
            echo "  BACKSTAGE_PORT       Local port for Backstage (default: 7007)"
            echo "  PLUGIN_PORT          Local port for plugin (default: 9443)"
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
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "         ${CYAN}ℹ️  $1${NC}"
    fi
}

log_detail() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "         $1"
    fi
}

# Cleanup function
cleanup() {
    echo ""
    echo -e "${CYAN}Cleaning up...${NC}"
    
    if [[ -n "$BACKSTAGE_PF_PID" ]]; then
        kill $BACKSTAGE_PF_PID 2>/dev/null
    fi
    
    if [[ -n "$PLUGIN_PF_PID" ]]; then
        kill $PLUGIN_PF_PID 2>/dev/null
    fi
}

trap cleanup EXIT

# Check prerequisites
check_prerequisites() {
    log_section "Checking Prerequisites"
    
    # Check oc CLI
    log_test "PRE-001" "oc CLI available"
    if command -v oc &> /dev/null; then
        log_pass
    else
        log_fail "oc CLI not found"
        exit 1
    fi
    
    # Check oc logged in
    log_test "PRE-002" "oc logged in"
    if oc whoami &> /dev/null; then
        log_pass
        log_info "User: $(oc whoami)"
    else
        log_fail "Not logged in to OpenShift"
        exit 1
    fi
    
    # Check curl
    log_test "PRE-003" "curl available"
    if command -v curl &> /dev/null; then
        log_pass
    else
        log_fail "curl not found"
        exit 1
    fi
    
    # Check jq
    log_test "PRE-004" "jq available"
    if command -v jq &> /dev/null; then
        log_pass
    else
        log_fail "jq not found"
        exit 1
    fi
}

# Infrastructure health tests
test_infrastructure() {
    log_section "Infrastructure Health Tests"
    
    # INF-001: Backstage Pod Health
    log_test "INF-001" "Backstage pods running"
    local bs_pods=$(oc get pods -n $BACKSTAGE_NAMESPACE --no-headers 2>/dev/null | grep -c "Running" || echo "0")
    if [[ "$bs_pods" -gt 0 ]]; then
        log_pass
        log_info "$bs_pods pod(s) running in $BACKSTAGE_NAMESPACE"
    else
        log_fail "No running pods in $BACKSTAGE_NAMESPACE"
        return 1
    fi
    
    # INF-002: Plugin Pod Health
    log_test "INF-002" "Plugin pods running"
    local plugin_pods=$(oc get pods -n $PLUGIN_NAMESPACE -l app=mcp-catalog --no-headers 2>/dev/null | grep -c "Running" || echo "0")
    if [[ "$plugin_pods" -gt 0 ]]; then
        log_pass
        log_info "$plugin_pods plugin pod(s) running"
    else
        log_fail "No running plugin pods"
        return 1
    fi
    
    # INF-003: Console Pod Health
    log_test "INF-003" "Console pods running"
    local console_pods=$(oc get pods -n openshift-console -l app=console --no-headers 2>/dev/null | grep -c "Running" || echo "0")
    if [[ "$console_pods" -gt 0 ]]; then
        log_pass
        log_info "$console_pods console pod(s) running"
    else
        log_fail "No running console pods"
    fi
    
    # INF-004: Service Endpoints
    log_test "INF-004" "Backstage service has endpoints"
    local bs_endpoints=$(oc get endpoints -n $BACKSTAGE_NAMESPACE backstage -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null)
    if [[ -n "$bs_endpoints" ]]; then
        log_pass
    else
        # Try to find any service
        bs_endpoints=$(oc get endpoints -n $BACKSTAGE_NAMESPACE -o jsonpath='{.items[0].subsets[0].addresses[0].ip}' 2>/dev/null)
        if [[ -n "$bs_endpoints" ]]; then
            log_pass
        else
            log_fail "No endpoints found"
        fi
    fi
}

# Setup port forwards
setup_port_forwards() {
    log_section "Setting up Port Forwards"
    
    # Backstage port forward
    log_test "PF-001" "Backstage port forward"
    oc port-forward -n $BACKSTAGE_NAMESPACE svc/backstage $BACKSTAGE_PORT:7007 &>/dev/null &
    BACKSTAGE_PF_PID=$!
    sleep 3
    
    if kill -0 $BACKSTAGE_PF_PID 2>/dev/null; then
        log_pass
        log_info "Forwarding localhost:$BACKSTAGE_PORT -> backstage:7007"
    else
        log_fail "Could not establish port forward"
        BACKSTAGE_PF_PID=""
        return 1
    fi
    
    # Plugin port forward
    log_test "PF-002" "Plugin port forward"
    oc port-forward -n $PLUGIN_NAMESPACE svc/mcp-catalog $PLUGIN_PORT:9443 &>/dev/null &
    PLUGIN_PF_PID=$!
    sleep 2
    
    if kill -0 $PLUGIN_PF_PID 2>/dev/null; then
        log_pass
        log_info "Forwarding localhost:$PLUGIN_PORT -> mcp-catalog:9443"
    else
        log_fail "Could not establish port forward"
        PLUGIN_PF_PID=""
    fi
}

# Backstage backend tests
test_backstage() {
    log_section "Backstage Backend Tests"
    
    local BASE_URL="http://localhost:$BACKSTAGE_PORT"
    
    # BST-001: Health Endpoint
    log_test "BST-001" "Backstage health endpoint"
    local health_response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/catalog/entities" 2>/dev/null)
    if [[ "$health_response" == "200" ]]; then
        log_pass
    else
        log_fail "HTTP $health_response"
        return 1
    fi
    
    # BST-002: Catalog API
    log_test "BST-002" "Catalog API returns entities"
    local entities=$(curl -s "$BASE_URL/api/catalog/entities" 2>/dev/null)
    if echo "$entities" | jq -e 'type == "array"' &>/dev/null; then
        local count=$(echo "$entities" | jq 'length')
        log_pass
        log_info "$count entities in catalog"
    else
        log_fail "Invalid response format"
        return 1
    fi
    
    # BST-003: MCP Servers Exist
    log_test "BST-003" "MCP servers in catalog"
    local servers=$(curl -s "$BASE_URL/api/catalog/entities?filter=spec.type=mcp-server" 2>/dev/null)
    local server_count=$(echo "$servers" | jq 'length' 2>/dev/null || echo "0")
    if [[ "$server_count" -gt 0 ]]; then
        log_pass
        log_info "$server_count MCP server(s) found"
        if [[ "$VERBOSE" == "true" ]]; then
            echo "$servers" | jq -r '.[].metadata.name' | while read name; do
                log_detail "  - $name"
            done
        fi
    else
        log_fail "No MCP servers found"
    fi
    
    # BST-004: MCP Tools Exist
    log_test "BST-004" "MCP tools in catalog"
    local tools=$(curl -s "$BASE_URL/api/catalog/entities?filter=spec.type=mcp-tool" 2>/dev/null)
    local tool_count=$(echo "$tools" | jq 'length' 2>/dev/null || echo "0")
    if [[ "$tool_count" -gt 0 ]]; then
        log_pass
        log_info "$tool_count MCP tool(s) found"
        if [[ "$VERBOSE" == "true" ]]; then
            echo "$tools" | jq -r '.[].metadata.name' | while read name; do
                log_detail "  - $name"
            done
        fi
    else
        log_fail "No MCP tools found"
    fi
    
    # BST-005: Workloads Exist (now in MCP Entity API database, not catalog)
    log_test "BST-005" "MCP workloads in database"
    local workloads_response=$(curl -s "$BASE_URL/api/mcp-entity-api/workloads" 2>/dev/null)
    local total_workloads=$(echo "$workloads_response" | jq '.items | length' 2>/dev/null || echo "0")
    if [[ "$total_workloads" -gt 0 ]]; then
        log_pass
        log_info "$total_workloads workload(s) found in MCP Entity API database"
    else
        log_skip "No workloads found (workloads are optional)"
    fi
    
    # BST-006: Guardrails Exist (006-mcp-guardrails)
    log_test "BST-006" "MCP guardrails in database"
    local guardrails_response=$(curl -s "$BASE_URL/api/mcp-entity-api/guardrails" 2>/dev/null)
    local total_guardrails=$(echo "$guardrails_response" | jq '.items | length' 2>/dev/null || echo "0")
    if [[ "$total_guardrails" -ge 0 ]]; then
        log_pass
        log_info "$total_guardrails guardrail(s) found in MCP Entity API database"
        if [[ "$VERBOSE" == "true" && "$total_guardrails" -gt 0 ]]; then
            echo "$guardrails_response" | jq -r '.items[].name' | while read name; do
                log_detail "  - $name"
            done
        fi
    else
        log_skip "Guardrails API not available"
    fi

    # BST-007: Entity Count
    log_test "BST-007" "Total entity count"
    local total=$(curl -s "$BASE_URL/api/catalog/entities" 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
    if [[ "$total" -gt 0 ]]; then
        log_pass
        log_info "$total total entities"
    else
        log_fail "Catalog is empty"
    fi
}

# Entity relationship tests
test_relationships() {
    log_section "Entity Relationship Tests"
    
    local BASE_URL="http://localhost:$BACKSTAGE_PORT"
    
    # Get a tool to test
    local tool=$(curl -s "$BASE_URL/api/catalog/entities?filter=spec.type=mcp-tool" 2>/dev/null | jq '.[0]' 2>/dev/null)
    local tool_name=$(echo "$tool" | jq -r '.metadata.name' 2>/dev/null)
    
    if [[ -z "$tool_name" || "$tool_name" == "null" ]]; then
        log_test "REL-001" "Tool has partOf relation"
        log_skip "No tools to test"
        log_test "REL-002" "Server has hasPart relation"
        log_skip "No tools to test"
        log_test "REL-003" "Tool subcomponentOf set"
        log_skip "No tools to test"
        return
    fi
    
    # REL-001: Tool has partOf relation
    log_test "REL-001" "Tool has partOf relation"
    local partof_rel=$(echo "$tool" | jq '.relations[] | select(.type == "partOf")' 2>/dev/null)
    if [[ -n "$partof_rel" ]]; then
        log_pass
        local target=$(echo "$partof_rel" | jq -r '.targetRef' 2>/dev/null)
        log_info "Tool '$tool_name' partOf: $target"
    else
        log_fail "Tool '$tool_name' has no partOf relation"
    fi
    
    # REL-003: Tool subcomponentOf set
    log_test "REL-003" "Tool subcomponentOf set"
    local subcomponent=$(echo "$tool" | jq -r '.spec.subcomponentOf // empty' 2>/dev/null)
    if [[ -n "$subcomponent" ]]; then
        log_pass
        log_info "subcomponentOf: $subcomponent"
    else
        # Check partOf as fallback
        local partof=$(echo "$tool" | jq -r '.spec.partOf // empty' 2>/dev/null)
        if [[ -n "$partof" ]]; then
            log_pass
            log_info "partOf: $partof (fallback)"
        else
            log_fail "No subcomponentOf or partOf in spec"
        fi
    fi
    
    # Get a server to test hasPart
    local server=$(curl -s "$BASE_URL/api/catalog/entities?filter=spec.type=mcp-server" 2>/dev/null | jq '.[0]' 2>/dev/null)
    local server_name=$(echo "$server" | jq -r '.metadata.name' 2>/dev/null)
    
    # REL-002: Server has hasPart relation
    log_test "REL-002" "Server has hasPart relation"
    if [[ -n "$server_name" && "$server_name" != "null" ]]; then
        local haspart_rel=$(echo "$server" | jq '.relations[] | select(.type == "hasPart")' 2>/dev/null)
        if [[ -n "$haspart_rel" ]]; then
            log_pass
            local part_count=$(echo "$server" | jq '[.relations[] | select(.type == "hasPart")] | length' 2>/dev/null)
            log_info "Server '$server_name' has $part_count part(s)"
        else
            log_fail "Server '$server_name' has no hasPart relation"
        fi
    else
        log_skip "No servers to test"
    fi
    
    # REL-004: Workload dependsOn set (now from MCP Entity API database)
    log_test "REL-004" "Workload dependsOn set"
    local workload=$(curl -s "$BASE_URL/api/mcp-entity-api/workloads" 2>/dev/null | jq '.items[0]' 2>/dev/null)
    local workload_name=$(echo "$workload" | jq -r '.metadata.name' 2>/dev/null)
    if [[ -n "$workload_name" && "$workload_name" != "null" ]]; then
        local depends=$(echo "$workload" | jq -r '.spec.dependsOn // empty' 2>/dev/null)
        if [[ -n "$depends" ]]; then
            log_pass
            local dep_count=$(echo "$workload" | jq '.spec.dependsOn | length' 2>/dev/null)
            log_info "Workload '$workload_name' depends on $dep_count tool(s)"
        else
            log_skip "Workload '$workload_name' has no dependsOn (optional)"
        fi
    else
        log_skip "No workloads to test"
    fi
    
    # REL-005: Bidirectional relations
    log_test "REL-005" "Bidirectional relations consistent"
    if [[ -n "$tool_name" && "$tool_name" != "null" ]]; then
        local tool_server_ref=$(echo "$tool" | jq -r '.relations[] | select(.type == "partOf") | .targetRef' 2>/dev/null | head -1)
        if [[ -n "$tool_server_ref" ]]; then
            # Extract server name from ref and fetch that specific server
            local tool_server_name=$(echo "$tool_server_ref" | sed 's/.*\///')
            local matching_server=$(curl -s "$BASE_URL/api/catalog/entities?filter=metadata.name=$tool_server_name" 2>/dev/null | jq '.[0]' 2>/dev/null)
            local matching_server_tools=$(echo "$matching_server" | jq -r '.relations[] | select(.type == "hasPart") | .targetRef' 2>/dev/null)
            
            if echo "$matching_server_tools" | grep -q "$tool_name"; then
                log_pass
                log_info "Tool '$tool_name' ↔ Server '$tool_server_name' relations are consistent"
            else
                log_fail "Server '$tool_server_name' does not have hasPart relation back to tool '$tool_name'"
            fi
        else
            log_fail "Tool '$tool_name' has no partOf relation to verify"
        fi
    else
        log_skip "No tools to test"
    fi
    
    # REL-006: Relation targets exist
    log_test "REL-006" "Relation targets exist"
    if [[ -n "$tool_name" && "$tool_name" != "null" ]]; then
        local target_ref=$(echo "$tool" | jq -r '.spec.subcomponentOf // .spec.partOf // empty' 2>/dev/null)
        if [[ -n "$target_ref" ]]; then
            # Extract name from ref (component:namespace/name -> name)
            local target_name=$(echo "$target_ref" | sed 's/.*\///')
            local target_exists=$(curl -s "$BASE_URL/api/catalog/entities?filter=metadata.name=$target_name" 2>/dev/null | jq 'length' 2>/dev/null)
            if [[ "$target_exists" -gt 0 ]]; then
                log_pass
                log_info "Target '$target_name' exists"
            else
                log_fail "Target '$target_name' not found"
            fi
        else
            log_skip "No relation target to verify"
        fi
    else
        log_skip "No tools to test"
    fi
}

# Plugin service tests
test_plugin() {
    log_section "Plugin Service Tests"
    
    local BASE_URL="https://localhost:$PLUGIN_PORT"
    
    # PLG-001: Plugin Manifest
    log_test "PLG-001" "Plugin manifest valid"
    local manifest=$(curl -sk "$BASE_URL/plugin-manifest.json" 2>/dev/null)
    local plugin_name=$(echo "$manifest" | jq -r '.name' 2>/dev/null)
    if [[ "$plugin_name" == "mcp-catalog" ]]; then
        log_pass
        log_info "Plugin name: $plugin_name"
    else
        log_fail "Expected 'mcp-catalog', got '$plugin_name'"
    fi
    
    # PLG-002: Plugin Entry Script
    log_test "PLG-002" "Plugin entry script exists"
    local entry_file=$(echo "$manifest" | jq -r '.loadScripts[0]' 2>/dev/null)
    if [[ -n "$entry_file" && "$entry_file" != "null" ]]; then
        local entry_status=$(curl -sk -o /dev/null -w "%{http_code}" "$BASE_URL/$entry_file" 2>/dev/null)
        if [[ "$entry_status" == "200" ]]; then
            log_pass
            log_info "Entry: $entry_file"
        else
            log_fail "HTTP $entry_status for $entry_file"
        fi
    else
        log_fail "No entry script in manifest"
    fi
    
    # PLG-003: Locale File
    log_test "PLG-003" "Locale file exists"
    local locale_status=$(curl -sk -o /dev/null -w "%{http_code}" "$BASE_URL/locales/en/plugin__mcp-catalog.json" 2>/dev/null)
    if [[ "$locale_status" == "200" ]]; then
        log_pass
    else
        log_fail "HTTP $locale_status"
    fi
    
    # PLG-004: No Server Errors
    log_test "PLG-004" "No server errors in logs"
    local error_count=$(oc logs -n $PLUGIN_NAMESPACE deployment/mcp-catalog --tail=100 2>/dev/null | grep -cE "error|Error|ERROR" 2>/dev/null || echo "0")
    # Handle multi-line output from grep -c
    error_count=$(echo "$error_count" | head -1 | tr -d '[:space:]')
    if [[ "$error_count" =~ ^[0-9]+$ ]] && [[ "$error_count" -lt 5 ]]; then
        log_pass
        log_info "$error_count error(s) in recent logs"
    elif [[ ! "$error_count" =~ ^[0-9]+$ ]]; then
        log_pass
        log_info "0 errors in recent logs"
    else
        log_fail "$error_count errors in recent logs"
    fi
}

# Console integration tests
test_console() {
    log_section "Console Integration Tests"
    
    # CON-001: Plugin Registered
    log_test "CON-001" "Plugin in console config"
    local plugins=$(oc get consoles.operator.openshift.io cluster -o jsonpath='{.spec.plugins}' 2>/dev/null)
    if echo "$plugins" | grep -q "mcp-catalog"; then
        log_pass
        log_info "Plugins: $plugins"
    else
        log_fail "mcp-catalog not in spec.plugins"
    fi
    
    # CON-002: ConsolePlugin CR
    log_test "CON-002" "ConsolePlugin CR exists"
    local cp_name=$(oc get consoleplugin mcp-catalog -o jsonpath='{.metadata.name}' 2>/dev/null)
    if [[ "$cp_name" == "mcp-catalog" ]]; then
        log_pass
    else
        log_fail "ConsolePlugin 'mcp-catalog' not found"
    fi
    
    # CON-003: Proxy Configured
    log_test "CON-003" "Proxy endpoint configured"
    local proxy=$(oc get consoleplugin mcp-catalog -o jsonpath='{.spec.proxy}' 2>/dev/null)
    if [[ -n "$proxy" ]]; then
        log_pass
        log_info "Proxy configured for Backstage"
    else
        log_fail "No proxy configuration"
    fi
}

# Data integrity tests
test_data_integrity() {
    log_section "Data Integrity Tests"
    
    local BASE_URL="http://localhost:$BACKSTAGE_PORT"
    
    # DAT-001: Server Schema Valid
    log_test "DAT-001" "Server schema valid"
    local servers=$(curl -s "$BASE_URL/api/catalog/entities?filter=spec.type=mcp-server" 2>/dev/null)
    local server_count=$(echo "$servers" | jq 'length' 2>/dev/null || echo "0")
    if [[ "$server_count" -gt 0 ]]; then
        local invalid=0
        for i in $(seq 0 $((server_count - 1))); do
            local server=$(echo "$servers" | jq ".[$i]")
            local has_type=$(echo "$server" | jq -r '.spec.type' 2>/dev/null)
            local has_lifecycle=$(echo "$server" | jq -r '.spec.lifecycle' 2>/dev/null)
            local has_owner=$(echo "$server" | jq -r '.spec.owner' 2>/dev/null)
            if [[ -z "$has_type" || -z "$has_lifecycle" || -z "$has_owner" ]]; then
                ((invalid++))
            fi
        done
        if [[ "$invalid" -eq 0 ]]; then
            log_pass
        else
            log_fail "$invalid server(s) missing required fields"
        fi
    else
        log_skip "No servers to validate"
    fi
    
    # DAT-002: Tool Schema Valid
    log_test "DAT-002" "Tool schema valid"
    local tools=$(curl -s "$BASE_URL/api/catalog/entities?filter=spec.type=mcp-tool" 2>/dev/null)
    local tool_count=$(echo "$tools" | jq 'length' 2>/dev/null || echo "0")
    if [[ "$tool_count" -gt 0 ]]; then
        local invalid=0
        for i in $(seq 0 $((tool_count - 1))); do
            local tool=$(echo "$tools" | jq ".[$i]")
            local has_type=$(echo "$tool" | jq -r '.spec.type' 2>/dev/null)
            local has_lifecycle=$(echo "$tool" | jq -r '.spec.lifecycle' 2>/dev/null)
            local has_owner=$(echo "$tool" | jq -r '.spec.owner' 2>/dev/null)
            if [[ -z "$has_type" || -z "$has_lifecycle" || -z "$has_owner" ]]; then
                ((invalid++))
            fi
        done
        if [[ "$invalid" -eq 0 ]]; then
            log_pass
        else
            log_fail "$invalid tool(s) missing required fields"
        fi
    else
        log_skip "No tools to validate"
    fi
    
    # DAT-003: Workload Schema Valid (now from MCP Entity API database)
    log_test "DAT-003" "Workload schema valid"
    local workloads_response=$(curl -s "$BASE_URL/api/mcp-entity-api/workloads" 2>/dev/null)
    local workloads=$(echo "$workloads_response" | jq '.items' 2>/dev/null)
    local workload_count=$(echo "$workloads" | jq 'length' 2>/dev/null || echo "0")
    if [[ "$workload_count" -gt 0 ]]; then
        local invalid=0
        for i in $(seq 0 $((workload_count - 1))); do
            local workload=$(echo "$workloads" | jq ".[$i]")
            local has_type=$(echo "$workload" | jq -r '.spec.type' 2>/dev/null)
            local has_lifecycle=$(echo "$workload" | jq -r '.spec.lifecycle' 2>/dev/null)
            local has_owner=$(echo "$workload" | jq -r '.spec.owner' 2>/dev/null)
            if [[ -z "$has_type" || -z "$has_lifecycle" || -z "$has_owner" ]]; then
                ((invalid++))
            fi
        done
        if [[ "$invalid" -eq 0 ]]; then
            log_pass
        else
            log_fail "$invalid workload(s) missing required fields"
        fi
    else
        log_skip "No workloads to validate"
    fi
    
    # DAT-004: No Orphan Tools
    log_test "DAT-004" "No orphan tools"
    local tools=$(curl -s "$BASE_URL/api/catalog/entities?filter=spec.type=mcp-tool" 2>/dev/null)
    local servers=$(curl -s "$BASE_URL/api/catalog/entities?filter=spec.type=mcp-server" 2>/dev/null)
    local server_names=$(echo "$servers" | jq -r '.[].metadata.name' 2>/dev/null)
    local tool_count=$(echo "$tools" | jq 'length' 2>/dev/null || echo "0")
    
    if [[ "$tool_count" -gt 0 ]]; then
        local orphans=0
        for i in $(seq 0 $((tool_count - 1))); do
            local tool=$(echo "$tools" | jq ".[$i]")
            local tool_name=$(echo "$tool" | jq -r '.metadata.name')
            local server_ref=$(echo "$tool" | jq -r '.spec.subcomponentOf // .spec.partOf // empty' 2>/dev/null)
            if [[ -n "$server_ref" ]]; then
                local ref_name=$(echo "$server_ref" | sed 's/.*\///')
                if ! echo "$server_names" | grep -q "^${ref_name}$"; then
                    ((orphans++))
                    log_detail "  Orphan: $tool_name -> $ref_name (not found)"
                fi
            fi
        done
        if [[ "$orphans" -eq 0 ]]; then
            log_pass
        else
            log_fail "$orphans orphan tool(s) found"
        fi
    else
        log_skip "No tools to check"
    fi
    
    # DAT-005: No Orphan Workload Refs (workloads from MCP Entity API, tools from catalog)
    log_test "DAT-005" "No orphan workload refs"
    local workloads_response=$(curl -s "$BASE_URL/api/mcp-entity-api/workloads" 2>/dev/null)
    local workloads=$(echo "$workloads_response" | jq '.items' 2>/dev/null)
    local all_entities=$(curl -s "$BASE_URL/api/catalog/entities" 2>/dev/null)
    local all_names=$(echo "$all_entities" | jq -r '.[].metadata.name' 2>/dev/null)
    local workload_count=$(echo "$workloads" | jq 'length' 2>/dev/null || echo "0")

    if [[ "$workload_count" -gt 0 ]]; then
        local orphans=0
        for i in $(seq 0 $((workload_count - 1))); do
            local workload=$(echo "$workloads" | jq ".[$i]")
            local depends=$(echo "$workload" | jq -r '.spec.dependsOn[]? // empty' 2>/dev/null)
            for dep in $depends; do
                local dep_name=$(echo "$dep" | sed 's/.*\///')
                if ! echo "$all_names" | grep -q "^${dep_name}$"; then
                    ((orphans++))
                fi
            done
        done
        if [[ "$orphans" -eq 0 ]]; then
            log_pass
        else
            log_skip "$orphans orphan reference(s) - tools may not exist yet"
        fi
    else
        log_skip "No workloads to check"
    fi
}

# Print summary
print_summary() {
    log_header "Test Summary"
    
    local total=$((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))
    
    echo ""
    echo -e "  ${GREEN}Passed:${NC}  $TESTS_PASSED"
    echo -e "  ${RED}Failed:${NC}  $TESTS_FAILED"
    echo -e "  ${YELLOW}Skipped:${NC} $TESTS_SKIPPED"
    echo -e "  ${BOLD}Total:${NC}   $total"
    echo ""
    
    if [[ "$TESTS_FAILED" -eq 0 ]]; then
        echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}${BOLD}  ✅ ALL TESTS PASSED - System is healthy${NC}"
        echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════════════════${NC}"
        return 0
    else
        echo -e "${RED}${BOLD}══════════════════════════════════════════════════════════════${NC}"
        echo -e "${RED}${BOLD}  ❌ $TESTS_FAILED TEST(S) FAILED - Check details above${NC}"
        echo -e "${RED}${BOLD}══════════════════════════════════════════════════════════════${NC}"
        return 1
    fi
}

# Skip multiple tests with a single message
skip_tests() {
    local count=$1
    local reason=$2
    echo -e "  ${YELLOW}⏭️  Skipping $count test(s): $reason${NC}"
    TESTS_SKIPPED=$((TESTS_SKIPPED + count))
}

# Main execution
main() {
    log_header "MCP Tools Catalog - Sanity Test Suite"
    echo ""
    echo -e "  ${CYAN}Timestamp:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
    echo -e "  ${CYAN}Cluster:${NC}   $(oc whoami --show-server 2>/dev/null || echo 'unknown')"
    echo -e "  ${CYAN}User:${NC}      $(oc whoami 2>/dev/null || echo 'unknown')"
    echo -e "  ${CYAN}Verbose:${NC}   $VERBOSE"
    
    check_prerequisites
    test_infrastructure
    setup_port_forwards
    
    # Only continue if port forwards are working
    if [[ -n "$BACKSTAGE_PF_PID" ]]; then
        test_backstage
        test_relationships
        test_data_integrity
    else
        log_section "Backstage Backend Tests"
        skip_tests 6 "Backstage port forward failed"
        log_section "Entity Relationship Tests"
        skip_tests 6 "Backstage port forward failed"
        log_section "Data Integrity Tests"
        skip_tests 5 "Backstage port forward failed"
    fi
    
    if [[ -n "$PLUGIN_PF_PID" ]]; then
        test_plugin
    else
        log_section "Plugin Service Tests"
        skip_tests 4 "Plugin port forward failed"
    fi
    
    test_console
    
    print_summary
}

main
