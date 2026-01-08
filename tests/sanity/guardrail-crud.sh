#!/bin/bash
#
# MCP Entity API - Guardrail CRUD Test Script (006-mcp-guardrails)
#
# This script tests the database-only guardrail operations:
# - POST /guardrails (create)
# - POST /guardrails/import (import from YAML)
# - GET /guardrails, GET /guardrails/:ns/:name (list/get)
# - PUT /guardrails/:ns/:name (update and rename)
# - DELETE /guardrails/:ns/:name (delete with reference protection)
# - PATCH /guardrails/:ns/:name/disabled (toggle disabled state)
#
# Usage: ./guardrail-crud.sh [--skip-cleanup] [--verbose]
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
TEST_GUARDRAIL_1="test-gr-crud-1-$$"
TEST_GUARDRAIL_2="test-gr-crud-2-$$"
TEST_GUARDRAIL_IMPORT="test-gr-import-$$"
TEST_GUARDRAIL_RENAME="test-gr-renamed-$$"
TEST_GUARDRAIL_MULTI_1="test-gr-multi-1-$$"
TEST_GUARDRAIL_MULTI_2="test-gr-multi-2-$$"
TEST_GUARDRAIL_MULTI_3="test-gr-multi-3-$$"
TEST_GUARDRAIL_TOOL="test-gr-tool-$$"

# Track created entities for cleanup
CREATED_GUARDRAILS=()
TOOL_GUARDRAIL_ASSOCIATIONS=()

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
echo -e "${YELLOW}  Guardrail CRUD Tests (006-mcp-guardrails)${NC}"
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

# Test POST /guardrails (create)
test_create_guardrail() {
    echo ""
    echo -e "${YELLOW}Test: Create Guardrail${NC}"

    local response
    local http_code

    # Create first guardrail
    log_info "Creating guardrail: $TEST_GUARDRAIL_1"
    response=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {
                \"name\": \"$TEST_GUARDRAIL_1\",
                \"description\": \"Test guardrail for CRUD tests\"
            },
            \"spec\": {
                \"deployment\": \"sidecar-container\",
                \"parameters\": \"max_tokens: 1000\"
            }
        }" \
        -w "\n%{http_code}")

    http_code=$(echo "$response" | tail -1)
    log_verbose "Response code: $http_code"
    log_verbose "Response: $(echo "$response" | head -n -1)"

    if [[ "$http_code" == "201" ]]; then
        log_pass "POST /guardrails returned 201 Created"
        CREATED_GUARDRAILS+=("$TEST_GUARDRAIL_1")
    else
        log_fail "POST /guardrails expected 201, got $http_code"
        return 1
    fi

    # Test duplicate name returns 409
    log_info "Testing duplicate name (expecting 409 Conflict)"
    http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {\"name\": \"$TEST_GUARDRAIL_1\", \"description\": \"Duplicate\"},
            \"spec\": {\"deployment\": \"test\"}
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "409" ]]; then
        log_pass "Duplicate name returns 409 Conflict"
    else
        log_fail "Duplicate name expected 409, got $http_code"
    fi

    # Create second guardrail for rename test
    log_info "Creating second guardrail: $TEST_GUARDRAIL_2"
    http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {\"name\": \"$TEST_GUARDRAIL_2\", \"description\": \"Second guardrail\"},
            \"spec\": {\"deployment\": \"inline-check\"}
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "201" ]]; then
        log_pass "Second guardrail created successfully"
        CREATED_GUARDRAILS+=("$TEST_GUARDRAIL_2")
    else
        log_fail "Second guardrail creation expected 201, got $http_code"
    fi

    # Test validation: invalid name
    log_info "Testing invalid name (expecting 400)"
    http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {\"name\": \"Invalid_Name!\", \"description\": \"test\"},
            \"spec\": {\"deployment\": \"test\"}
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "400" ]]; then
        log_pass "Invalid name returns 400 Bad Request"
    else
        log_fail "Invalid name expected 400, got $http_code"
    fi

    # Test validation: missing required fields
    log_info "Testing missing description (expecting 400)"
    http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {\"name\": \"test-no-desc\"},
            \"spec\": {\"deployment\": \"test\"}
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "400" ]]; then
        log_pass "Missing description returns 400 Bad Request"
    else
        log_fail "Missing description expected 400, got $http_code"
    fi

    # Test creating guardrail with disabled=true
    log_info "Testing create guardrail with disabled=true"
    local disabled_name="test-gr-disabled-$$"
    response=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {\"name\": \"$disabled_name\", \"description\": \"Disabled guardrail test\"},
            \"spec\": {\"deployment\": \"test\", \"disabled\": true}
        }" \
        -w "\n%{http_code}")

    http_code=$(echo "$response" | tail -1)
    if [[ "$http_code" == "201" ]]; then
        log_pass "Created guardrail with disabled=true"
        CREATED_GUARDRAILS+=("$disabled_name")

        # Verify disabled state persists
        local disabled_state
        disabled_state=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$disabled_name" | jq -r '.disabled')
        if [[ "$disabled_state" == "true" ]]; then
            log_pass "Guardrail disabled state persisted correctly (disabled=true)"
        else
            log_fail "Guardrail disabled state expected true, got $disabled_state"
        fi
    else
        log_fail "Create guardrail with disabled=true expected 201, got $http_code"
    fi
}

# Test POST /guardrails/import (YAML import)
test_import_guardrail() {
    echo ""
    echo -e "${YELLOW}Test: Import Guardrail from YAML${NC}"

    local http_code
    local response

    # Create YAML content
    local yaml_content="metadata:
  name: $TEST_GUARDRAIL_IMPORT
  description: Imported guardrail from YAML
spec:
  deployment: webhook-service
  parameters: |
    endpoint: https://guardrail.example.com
    timeout: 30s"

    # Import via YAML
    log_info "Importing guardrail from YAML: $TEST_GUARDRAIL_IMPORT"
    response=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/import" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: text/yaml" \
        -d "$yaml_content" \
        -w "\n%{http_code}")

    http_code=$(echo "$response" | tail -1)
    log_verbose "Response code: $http_code"
    log_verbose "Response: $(echo "$response" | head -n -1)"

    if [[ "$http_code" == "201" ]]; then
        log_pass "POST /guardrails/import returned 201 Created"
        CREATED_GUARDRAILS+=("$TEST_GUARDRAIL_IMPORT")
    else
        log_fail "POST /guardrails/import expected 201, got $http_code"
        return 1
    fi

    # Verify imported data (guardrail API returns flat structure with .name, not .metadata.name)
    local name
    name=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_IMPORT" | jq -r '.name')
    if [[ "$name" == "$TEST_GUARDRAIL_IMPORT" ]]; then
        log_pass "Imported guardrail data is correct"
    else
        log_fail "Imported guardrail name mismatch: expected $TEST_GUARDRAIL_IMPORT, got $name"
    fi

    # Test invalid YAML
    log_info "Testing invalid YAML (expecting 400)"
    http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/import" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: text/yaml" \
        -d "invalid: yaml: content: [" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "400" ]]; then
        log_pass "Invalid YAML returns 400 Bad Request"
    else
        log_fail "Invalid YAML expected 400, got $http_code"
    fi

    # Test YAML with missing fields
    log_info "Testing YAML with missing fields (expecting 400)"
    http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/import" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: text/yaml" \
        -d "metadata:
  name: incomplete-guardrail" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "400" ]]; then
        log_pass "YAML with missing fields returns 400"
    else
        log_fail "YAML with missing fields expected 400, got $http_code"
    fi

    # Test importing YAML with disabled=true
    log_info "Testing import YAML with disabled=true"
    local disabled_import_name="test-gr-import-disabled-$$"
    local yaml_disabled="metadata:
  name: $disabled_import_name
  description: Imported disabled guardrail
spec:
  deployment: test-deployment
  disabled: true"

    response=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/import" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: text/yaml" \
        -d "$yaml_disabled" \
        -w "\n%{http_code}")

    http_code=$(echo "$response" | tail -1)
    if [[ "$http_code" == "201" ]]; then
        log_pass "Imported YAML with disabled=true"
        CREATED_GUARDRAILS+=("$disabled_import_name")

        # Verify disabled state persists
        local disabled_state
        disabled_state=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$disabled_import_name" | jq -r '.disabled')
        if [[ "$disabled_state" == "true" ]]; then
            log_pass "Imported guardrail disabled state persisted correctly (disabled=true)"
        else
            log_fail "Imported guardrail disabled state expected true, got $disabled_state"
        fi
    else
        log_fail "Import YAML with disabled=true expected 201, got $http_code"
    fi
}

# Test POST /guardrails/import with multi-document YAML
test_import_multi_guardrails() {
    echo ""
    echo -e "${YELLOW}Test: Import Multiple Guardrails from YAML${NC}"

    local http_code
    local response

    # Create multi-document YAML content
    local yaml_content="---
metadata:
  name: $TEST_GUARDRAIL_MULTI_1
  description: First multi-import guardrail
spec:
  deployment: sidecar-container
  parameters: 'max_tokens: 1000'
---
metadata:
  name: $TEST_GUARDRAIL_MULTI_2
  description: Second multi-import guardrail
spec:
  deployment: inline-middleware
---
metadata:
  name: $TEST_GUARDRAIL_MULTI_3
  description: Third multi-import guardrail
spec:
  deployment: webhook-service
  parameters: 'endpoint: https://example.com'"

    # Test preview mode first
    log_info "Testing preview mode with multi-document YAML"
    response=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/import?preview=true" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: text/yaml" \
        -d "$yaml_content" \
        -w "\n%{http_code}")

    http_code=$(echo "$response" | tail -1)
    log_verbose "Preview response code: $http_code"
    log_verbose "Preview response: $(echo "$response" | head -n -1)"

    if [[ "$http_code" == "200" ]]; then
        log_pass "Preview mode returned 200 OK"
    else
        log_fail "Preview mode expected 200, got $http_code"
        return 1
    fi

    # Verify preview count
    local preview_count
    preview_count=$(echo "$response" | head -n -1 | jq -r '.count')
    if [[ "$preview_count" == "3" ]]; then
        log_pass "Preview shows correct count: $preview_count"
    else
        log_fail "Preview count expected 3, got $preview_count"
    fi

    # Verify preview flag
    local preview_flag
    preview_flag=$(echo "$response" | head -n -1 | jq -r '.preview')
    if [[ "$preview_flag" == "true" ]]; then
        log_pass "Preview flag is true"
    else
        log_fail "Preview flag expected true, got $preview_flag"
    fi

    # Verify guardrail names in preview
    local preview_names
    preview_names=$(echo "$response" | head -n -1 | jq -r '.guardrails[].name' | sort | tr '\n' ' ')
    log_verbose "Preview names: $preview_names"

    # Now actually import the multi-document YAML
    log_info "Importing multi-document YAML"
    response=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/import" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: text/yaml" \
        -d "$yaml_content" \
        -w "\n%{http_code}")

    http_code=$(echo "$response" | tail -1)
    log_verbose "Import response code: $http_code"
    log_verbose "Import response: $(echo "$response" | head -n -1)"

    if [[ "$http_code" == "201" ]]; then
        log_pass "Multi-document import returned 201 Created"
        CREATED_GUARDRAILS+=("$TEST_GUARDRAIL_MULTI_1" "$TEST_GUARDRAIL_MULTI_2" "$TEST_GUARDRAIL_MULTI_3")
    else
        log_fail "Multi-document import expected 201, got $http_code"
        return 1
    fi

    # Verify import result structure
    local imported_count
    imported_count=$(echo "$response" | head -n -1 | jq -r '.imported')
    if [[ "$imported_count" == "3" ]]; then
        log_pass "Imported count is 3"
    else
        log_fail "Imported count expected 3, got $imported_count"
    fi

    local failed_count
    failed_count=$(echo "$response" | head -n -1 | jq -r '.failed')
    if [[ "$failed_count" == "0" ]]; then
        log_pass "Failed count is 0"
    else
        log_fail "Failed count expected 0, got $failed_count"
    fi

    # Verify all guardrails were created
    log_info "Verifying all guardrails were created"
    for name in "$TEST_GUARDRAIL_MULTI_1" "$TEST_GUARDRAIL_MULTI_2" "$TEST_GUARDRAIL_MULTI_3"; do
        http_code=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$name" \
            -o /dev/null -w "%{http_code}")
        if [[ "$http_code" == "200" ]]; then
            log_pass "Guardrail $name exists"
        else
            log_fail "Guardrail $name not found (HTTP $http_code)"
        fi
    done

    # Test partial failure: import again (should have conflicts)
    log_info "Testing partial failure with duplicate names"
    local partial_yaml="---
metadata:
  name: $TEST_GUARDRAIL_MULTI_1
  description: Duplicate - should fail
spec:
  deployment: test
---
metadata:
  name: test-gr-new-$$
  description: New guardrail - should succeed
spec:
  deployment: test"

    response=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/import" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: text/yaml" \
        -d "$partial_yaml" \
        -w "\n%{http_code}")

    http_code=$(echo "$response" | tail -1)
    log_verbose "Partial import response: $(echo "$response" | head -n -1)"

    # Should return 201 even with partial failures
    if [[ "$http_code" == "201" ]]; then
        log_pass "Partial failure import returned 201"
        CREATED_GUARDRAILS+=("test-gr-new-$$")
    else
        log_fail "Partial failure import expected 201, got $http_code"
    fi

    # Verify partial results
    imported_count=$(echo "$response" | head -n -1 | jq -r '.imported')
    failed_count=$(echo "$response" | head -n -1 | jq -r '.failed')
    if [[ "$imported_count" == "1" && "$failed_count" == "1" ]]; then
        log_pass "Partial import: 1 imported, 1 failed (as expected)"
    else
        log_fail "Partial import expected imported=1/failed=1, got imported=$imported_count/failed=$failed_count"
    fi
}

# Test GET /guardrails (list and get)
test_list_get_guardrail() {
    echo ""
    echo -e "${YELLOW}Test: List and Get Guardrails${NC}"

    local response
    local http_code
    local count

    # Test list guardrails (no auth required for read)
    log_info "Testing GET /guardrails (list)"
    response=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails" -w "\n%{http_code}")
    http_code=$(echo "$response" | tail -1)

    if [[ "$http_code" == "200" ]]; then
        log_pass "GET /guardrails returned 200 OK"
    else
        log_fail "GET /guardrails expected 200, got $http_code"
    fi

    # Verify our test guardrails are in the list
    count=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails" | jq "[.items[] | select(.name | startswith(\"test-gr-\"))] | length")
    if [[ "$count" -ge 2 ]]; then
        log_pass "Test guardrails found in list (count: $count)"
    else
        log_fail "Test guardrails not found in list (count: $count, expected >= 2)"
    fi

    # Test get specific guardrail
    log_info "Testing GET /guardrails/default/$TEST_GUARDRAIL_1"
    http_code=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_1" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "200" ]]; then
        log_pass "GET /guardrails/:ns/:name returned 200 OK"
    else
        log_fail "GET /guardrails/:ns/:name expected 200, got $http_code"
    fi

    # Verify guardrail data
    local name
    name=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_1" | jq -r '.name')
    if [[ "$name" == "$TEST_GUARDRAIL_1" ]]; then
        log_pass "Guardrail data is correct"
    else
        log_fail "Guardrail name mismatch: expected $TEST_GUARDRAIL_1, got $name"
    fi

    # Test get non-existent guardrail returns 404
    log_info "Testing GET non-existent guardrail (expecting 404)"
    http_code=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/non-existent-guardrail-xyz" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "404" ]]; then
        log_pass "Non-existent guardrail returns 404 Not Found"
    else
        log_fail "Non-existent guardrail expected 404, got $http_code"
    fi

    # Test get with usage info
    log_info "Testing guardrail includes usage information"
    local has_usage
    has_usage=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_1" | jq 'has("usage")')
    if [[ "$has_usage" == "true" ]]; then
        log_pass "Guardrail response includes usage information"
    else
        log_fail "Guardrail response missing usage information"
    fi
}

# Test PUT /guardrails (update and rename)
test_update_rename_guardrail() {
    echo ""
    echo -e "${YELLOW}Test: Update and Rename Guardrail${NC}"

    local http_code
    local description

    # Test update without rename
    log_info "Testing PUT /guardrails (update description)"
    http_code=$(curl -sk -X PUT "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_1" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {
                \"description\": \"Updated description for guardrail\"
            },
            \"spec\": {
                \"deployment\": \"updated-deployment\",
                \"parameters\": \"updated: true\"
            }
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "200" ]]; then
        log_pass "PUT /guardrails (update) returned 200 OK"
    else
        log_fail "PUT /guardrails (update) expected 200, got $http_code"
    fi

    # Verify update persisted
    description=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_1" | jq -r '.description')
    if [[ "$description" == "Updated description for guardrail" ]]; then
        log_pass "Update persisted correctly"
    else
        log_fail "Update not persisted: got '$description'"
    fi

    # Test rename
    log_info "Testing PUT /guardrails (rename $TEST_GUARDRAIL_2 -> $TEST_GUARDRAIL_RENAME)"
    http_code=$(curl -sk -X PUT "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_2" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {
                \"name\": \"$TEST_GUARDRAIL_RENAME\",
                \"description\": \"Renamed guardrail\"
            },
            \"spec\": {
                \"deployment\": \"inline-check\"
            }
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "200" ]]; then
        log_pass "PUT /guardrails (rename) returned 200 OK"
        # Update tracking for cleanup
        CREATED_GUARDRAILS=("${CREATED_GUARDRAILS[@]/$TEST_GUARDRAIL_2/}")
        CREATED_GUARDRAILS+=("$TEST_GUARDRAIL_RENAME")
    else
        log_fail "PUT /guardrails (rename) expected 200, got $http_code"
    fi

    # Verify old name returns 404
    log_info "Verifying old name returns 404"
    http_code=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_2" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "404" ]]; then
        log_pass "Old name returns 404 (rename successful)"
    else
        log_fail "Old name expected 404, got $http_code"
    fi

    # Verify new name exists
    log_info "Verifying new name exists"
    http_code=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_RENAME" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "200" ]]; then
        log_pass "New name returns 200 (rename verified)"
    else
        log_fail "New name expected 200, got $http_code"
    fi

    # Test rename to existing name returns 409
    log_info "Testing rename to existing name (expecting 409)"
    http_code=$(curl -sk -X PUT "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_RENAME" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {\"name\": \"$TEST_GUARDRAIL_1\", \"description\": \"test\"},
            \"spec\": {\"deployment\": \"test\"}
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "409" ]]; then
        log_pass "Rename to existing name returns 409 Conflict"
    else
        log_fail "Rename to existing expected 409, got $http_code"
    fi
}

# Test disable/enable via PUT (guardrails use PUT with spec.disabled, not a separate PATCH endpoint)
test_disable_enable_guardrail() {
    echo ""
    echo -e "${YELLOW}Test: Disable/Enable Guardrail via PUT${NC}"

    local http_code
    local disabled

    # Disable guardrail via PUT
    log_info "Disabling guardrail: $TEST_GUARDRAIL_1"
    http_code=$(curl -sk -X PUT "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_1" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {
                \"description\": \"Updated description for guardrail\"
            },
            \"spec\": {
                \"deployment\": \"updated-deployment\",
                \"disabled\": true
            }
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "200" ]]; then
        log_pass "PUT /guardrails with disabled=true returned 200 OK"
    else
        log_fail "PUT /guardrails with disabled=true expected 200, got $http_code"
    fi

    # Verify disabled state (flat structure: .disabled not .spec.disabled)
    disabled=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_1" | jq -r '.disabled')
    if [[ "$disabled" == "true" ]]; then
        log_pass "Guardrail disabled state is true"
    else
        log_fail "Guardrail disabled state expected true, got $disabled"
    fi

    # Enable guardrail via PUT
    log_info "Enabling guardrail: $TEST_GUARDRAIL_1"
    http_code=$(curl -sk -X PUT "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_1" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {
                \"description\": \"Updated description for guardrail\"
            },
            \"spec\": {
                \"deployment\": \"updated-deployment\",
                \"disabled\": false
            }
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "200" ]]; then
        log_pass "PUT /guardrails with disabled=false returned 200 OK"
    else
        log_fail "PUT /guardrails with disabled=false expected 200, got $http_code"
    fi

    # Verify enabled state
    disabled=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_1" | jq -r '.disabled')
    if [[ "$disabled" == "false" ]]; then
        log_pass "Guardrail disabled state is false (enabled)"
    else
        log_fail "Guardrail disabled state expected false, got $disabled"
    fi
}

# Test DELETE /guardrails (with reference protection)
test_delete_guardrail() {
    echo ""
    echo -e "${YELLOW}Test: Delete Guardrail${NC}"

    local http_code

    # Delete imported guardrail (should succeed - no references)
    log_info "Deleting guardrail: $TEST_GUARDRAIL_IMPORT"
    http_code=$(curl -sk -X DELETE "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_IMPORT" \
        -H "Authorization: Bearer $TOKEN" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "204" ]]; then
        log_pass "DELETE /guardrails returned 204 No Content"
        CREATED_GUARDRAILS=("${CREATED_GUARDRAILS[@]/$TEST_GUARDRAIL_IMPORT/}")
    else
        log_fail "DELETE /guardrails expected 204, got $http_code"
    fi

    # Verify immediate 404
    log_info "Verifying immediate 404 after delete"
    http_code=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_IMPORT" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "404" ]]; then
        log_pass "Deleted guardrail returns 404 immediately"
    else
        log_fail "Deleted guardrail expected 404, got $http_code"
    fi

    # Delete second attempt on same guardrail should return 404
    log_info "Testing double-delete returns 404"
    http_code=$(curl -sk -X DELETE "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_IMPORT" \
        -H "Authorization: Bearer $TOKEN" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "404" ]]; then
        log_pass "Double-delete returns 404 Not Found"
    else
        log_fail "Double-delete expected 404, got $http_code"
    fi

    # Delete non-existent guardrail returns 404
    log_info "Testing delete non-existent returns 404"
    http_code=$(curl -sk -X DELETE "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/non-existent-guardrail" \
        -H "Authorization: Bearer $TOKEN" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "404" ]]; then
        log_pass "Delete non-existent returns 404"
    else
        log_fail "Delete non-existent expected 404, got $http_code"
    fi
}

# Test RBAC (authentication required for mutations)
test_rbac() {
    echo ""
    echo -e "${YELLOW}Test: RBAC (Authentication Required)${NC}"

    local http_code

    # Test create without auth
    log_info "Testing POST without auth (expecting 401)"
    http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails" \
        -H "Content-Type: application/json" \
        -d '{"metadata":{"name":"no-auth","description":"test"},"spec":{"deployment":"test"}}' \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "401" ]]; then
        log_pass "POST without auth returns 401 Unauthorized"
    else
        log_fail "POST without auth expected 401, got $http_code"
    fi

    # Test update without auth
    log_info "Testing PUT without auth (expecting 401)"
    http_code=$(curl -sk -X PUT "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_1" \
        -H "Content-Type: application/json" \
        -d '{"metadata":{"description":"no auth"},"spec":{"deployment":"test"}}' \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "401" ]]; then
        log_pass "PUT without auth returns 401 Unauthorized"
    else
        log_fail "PUT without auth expected 401, got $http_code"
    fi

    # Test delete without auth
    log_info "Testing DELETE without auth (expecting 401)"
    http_code=$(curl -sk -X DELETE "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$TEST_GUARDRAIL_1" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "401" ]]; then
        log_pass "DELETE without auth returns 401 Unauthorized"
    else
        log_fail "DELETE without auth expected 401, got $http_code"
    fi
}

# Test tool-guardrail associations (T076 - Phase 5 US3)
test_tool_guardrail_associations() {
    echo ""
    echo -e "${YELLOW}Test: Tool-Guardrail Associations (US3)${NC}"

    local http_code
    local response

    # First, we need a tool to attach guardrails to
    # Get the first available tool from the catalog
    log_info "Finding an existing tool to test with..."
    response=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/tools" -w "\n%{http_code}")
    http_code=$(echo "$response" | tail -1)

    if [[ "$http_code" != "200" ]]; then
        log_info "No tools endpoint available (HTTP $http_code), skipping tool-guardrail tests"
        return 0
    fi

    local tool_count
    tool_count=$(echo "$response" | head -n -1 | jq '.items | length')
    if [[ "$tool_count" == "0" || "$tool_count" == "null" ]]; then
        log_info "No tools available in catalog, skipping tool-guardrail tests"
        return 0
    fi

    # Get first tool's namespace and name
    local tool_namespace
    local tool_name
    tool_namespace=$(echo "$response" | head -n -1 | jq -r '.items[0].metadata.namespace // "default"')
    tool_name=$(echo "$response" | head -n -1 | jq -r '.items[0].metadata.name')
    log_pass "Found tool: $tool_namespace/$tool_name"

    # Create a guardrail specifically for tool association tests
    log_info "Creating guardrail for tool association: $TEST_GUARDRAIL_TOOL"
    http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"metadata\": {\"name\": \"$TEST_GUARDRAIL_TOOL\", \"description\": \"Guardrail for tool association tests\"},
            \"spec\": {\"deployment\": \"pre-execution-check\"}
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "201" ]]; then
        log_pass "Created guardrail for tool association tests"
        CREATED_GUARDRAILS+=("$TEST_GUARDRAIL_TOOL")
    else
        log_fail "Failed to create guardrail for tool tests (HTTP $http_code)"
        return 1
    fi

    # Test 1: GET /tools/:ns/:name/guardrails - List guardrails (should be empty initially)
    log_info "Testing GET /tools/$tool_namespace/$tool_name/guardrails (list)"
    response=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/tools/$tool_namespace/$tool_name/guardrails" \
        -w "\n%{http_code}")
    http_code=$(echo "$response" | tail -1)

    if [[ "$http_code" == "200" ]]; then
        log_pass "GET /tools/:ns/:name/guardrails returned 200 OK"
    else
        log_fail "GET /tools/:ns/:name/guardrails expected 200, got $http_code"
    fi

    # Test 2: POST /tools/:ns/:name/guardrails - Attach guardrail (pre-execution)
    log_info "Testing POST /tools/$tool_namespace/$tool_name/guardrails (attach)"
    response=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/tools/$tool_namespace/$tool_name/guardrails" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"guardrailNamespace\": \"default\",
            \"guardrailName\": \"$TEST_GUARDRAIL_TOOL\",
            \"executionTiming\": \"pre-execution\"
        }" \
        -w "\n%{http_code}")
    http_code=$(echo "$response" | tail -1)
    log_verbose "Attach response: $(echo "$response" | head -n -1)"

    if [[ "$http_code" == "201" ]]; then
        log_pass "POST /tools/:ns/:name/guardrails returned 201 Created"
        TOOL_GUARDRAIL_ASSOCIATIONS+=("$tool_namespace/$tool_name/default/$TEST_GUARDRAIL_TOOL")
    else
        log_fail "POST /tools/:ns/:name/guardrails expected 201, got $http_code"
    fi

    # Verify the association response has expected fields
    local assoc_id
    assoc_id=$(echo "$response" | head -n -1 | jq -r '.id')
    if [[ -n "$assoc_id" && "$assoc_id" != "null" ]]; then
        log_pass "Association response includes id field"
    else
        log_fail "Association response missing id field"
    fi

    local exec_timing
    exec_timing=$(echo "$response" | head -n -1 | jq -r '.executionTiming')
    if [[ "$exec_timing" == "pre-execution" ]]; then
        log_pass "Association executionTiming is pre-execution"
    else
        log_fail "Association executionTiming expected pre-execution, got $exec_timing"
    fi

    # Test 3: GET /tools/:ns/:name/guardrails - Verify guardrail is attached
    log_info "Verifying guardrail is attached to tool"
    response=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/tools/$tool_namespace/$tool_name/guardrails")
    local attached_count
    attached_count=$(echo "$response" | jq '.items | length')
    if [[ "$attached_count" -ge 1 ]]; then
        log_pass "Tool has $attached_count guardrail(s) attached"
    else
        log_fail "Expected at least 1 guardrail attached, got $attached_count"
    fi

    # Verify the attached guardrail includes guardrail details
    local attached_name
    attached_name=$(echo "$response" | jq -r '.items[0].guardrail.name // empty')
    if [[ "$attached_name" == "$TEST_GUARDRAIL_TOOL" ]]; then
        log_pass "Attached guardrail includes guardrail details"
    else
        log_fail "Attached guardrail missing details (name: $attached_name)"
    fi

    # Test 4: POST duplicate attachment - should return 409
    log_info "Testing duplicate attachment (expecting 409)"
    http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/tools/$tool_namespace/$tool_name/guardrails" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"guardrailNamespace\": \"default\",
            \"guardrailName\": \"$TEST_GUARDRAIL_TOOL\",
            \"executionTiming\": \"post-execution\"
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "409" ]]; then
        log_pass "Duplicate attachment returns 409 Conflict"
    else
        log_fail "Duplicate attachment expected 409, got $http_code"
    fi

    # Test 5: POST with invalid executionTiming - should return 400
    log_info "Testing invalid executionTiming (expecting 400)"
    http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/tools/$tool_namespace/$tool_name/guardrails" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"guardrailNamespace\": \"default\",
            \"guardrailName\": \"$TEST_GUARDRAIL_TOOL\",
            \"executionTiming\": \"invalid-timing\"
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "400" ]]; then
        log_pass "Invalid executionTiming returns 400 Bad Request"
    else
        log_fail "Invalid executionTiming expected 400, got $http_code"
    fi

    # Test 6: POST with non-existent guardrail - should return 404
    log_info "Testing attachment of non-existent guardrail (expecting 404)"
    http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/tools/$tool_namespace/$tool_name/guardrails" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"guardrailNamespace\": \"default\",
            \"guardrailName\": \"non-existent-guardrail-xyz\",
            \"executionTiming\": \"pre-execution\"
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "404" ]]; then
        log_pass "Non-existent guardrail returns 404 Not Found"
    else
        log_fail "Non-existent guardrail expected 404, got $http_code"
    fi

    # Test 7: GET guardrails for non-existent tool - should return 404
    log_info "Testing GET guardrails for non-existent tool (expecting 404)"
    http_code=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/tools/default/non-existent-tool-xyz/guardrails" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "404" ]]; then
        log_pass "Non-existent tool returns 404 Not Found"
    else
        log_fail "Non-existent tool expected 404, got $http_code"
    fi

    # Test 8: DELETE /tools/:ns/:name/guardrails/:gNs/:gName - Detach guardrail
    log_info "Testing DELETE /tools/$tool_namespace/$tool_name/guardrails/default/$TEST_GUARDRAIL_TOOL (detach)"
    http_code=$(curl -sk -X DELETE "${BACKSTAGE_URL}/api/mcp-entity-api/tools/$tool_namespace/$tool_name/guardrails/default/$TEST_GUARDRAIL_TOOL" \
        -H "Authorization: Bearer $TOKEN" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "204" ]]; then
        log_pass "DELETE /tools/:ns/:name/guardrails/:gNs/:gName returned 204 No Content"
        # Remove from tracking
        TOOL_GUARDRAIL_ASSOCIATIONS=("${TOOL_GUARDRAIL_ASSOCIATIONS[@]/$tool_namespace\/$tool_name\/default\/$TEST_GUARDRAIL_TOOL/}")
    else
        log_fail "DELETE /tools/:ns/:name/guardrails expected 204, got $http_code"
    fi

    # Test 9: Verify guardrail is detached
    log_info "Verifying guardrail is detached"
    response=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/tools/$tool_namespace/$tool_name/guardrails")
    attached_count=$(echo "$response" | jq "[.items[] | select(.guardrail.name == \"$TEST_GUARDRAIL_TOOL\")] | length")
    if [[ "$attached_count" == "0" ]]; then
        log_pass "Guardrail successfully detached"
    else
        log_fail "Guardrail still attached after detach"
    fi

    # Test 10: DELETE non-existent association - should return 404
    log_info "Testing DELETE non-existent association (expecting 404)"
    http_code=$(curl -sk -X DELETE "${BACKSTAGE_URL}/api/mcp-entity-api/tools/$tool_namespace/$tool_name/guardrails/default/$TEST_GUARDRAIL_TOOL" \
        -H "Authorization: Bearer $TOKEN" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "404" ]]; then
        log_pass "DELETE non-existent association returns 404 Not Found"
    else
        log_fail "DELETE non-existent association expected 404, got $http_code"
    fi

    # Test 11: POST without auth - should return 401
    log_info "Testing POST attach without auth (expecting 401)"
    http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/tools/$tool_namespace/$tool_name/guardrails" \
        -H "Content-Type: application/json" \
        -d "{
            \"guardrailNamespace\": \"default\",
            \"guardrailName\": \"$TEST_GUARDRAIL_TOOL\",
            \"executionTiming\": \"pre-execution\"
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "401" ]]; then
        log_pass "POST attach without auth returns 401 Unauthorized"
    else
        log_fail "POST attach without auth expected 401, got $http_code"
    fi

    # Test 12: DELETE without auth - should return 401
    log_info "Testing DELETE detach without auth (expecting 401)"
    http_code=$(curl -sk -X DELETE "${BACKSTAGE_URL}/api/mcp-entity-api/tools/$tool_namespace/$tool_name/guardrails/default/$TEST_GUARDRAIL_TOOL" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "401" ]]; then
        log_pass "DELETE detach without auth returns 401 Unauthorized"
    else
        log_fail "DELETE detach without auth expected 401, got $http_code"
    fi

    # Test 13: POST /tools/:ns/:name/guardrails with parameters
    log_info "Testing POST attach with parameters"
    # Use a simple parameter string to avoid JSON escaping issues
    local test_params='maxTokens: 1000, timeout: 30s'
    response=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/tools/$tool_namespace/$tool_name/guardrails" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"guardrailNamespace\": \"default\",
            \"guardrailName\": \"$TEST_GUARDRAIL_TOOL\",
            \"executionTiming\": \"pre-execution\",
            \"parameters\": \"$test_params\"
        }" \
        -w "\n%{http_code}")
    http_code=$(echo "$response" | tail -1)
    log_verbose "Attach with params response: $(echo "$response" | head -n -1)"

    if [[ "$http_code" == "201" ]]; then
        log_pass "POST attach with parameters returned 201 Created"
        TOOL_GUARDRAIL_ASSOCIATIONS+=("$tool_namespace/$tool_name/default/$TEST_GUARDRAIL_TOOL")
    else
        log_fail "POST attach with parameters expected 201, got $http_code"
    fi

    # Test 14: Verify parameters are returned in attach response
    local returned_params
    returned_params=$(echo "$response" | head -n -1 | jq -r '.parameters // empty')
    if [[ -n "$returned_params" && "$returned_params" != "null" ]]; then
        log_pass "Attach response includes parameters field: '$returned_params'"
    else
        log_fail "Attach response missing parameters field"
    fi

    # Test 15: Verify parameters persist in list response
    log_info "Verifying parameters persist in list response"
    response=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/tools/$tool_namespace/$tool_name/guardrails")
    local list_params
    list_params=$(echo "$response" | jq -r ".items[] | select(.guardrail.name == \"$TEST_GUARDRAIL_TOOL\") | .parameters // empty")
    if [[ -n "$list_params" && "$list_params" != "null" ]]; then
        log_pass "Parameters persisted correctly in list response: '$list_params'"
    else
        log_fail "Parameters not persisted in list response"
    fi

    # Test 16: POST attach without parameters (optional field)
    # First detach the previous association
    curl -sk -X DELETE "${BACKSTAGE_URL}/api/mcp-entity-api/tools/$tool_namespace/$tool_name/guardrails/default/$TEST_GUARDRAIL_TOOL" \
        -H "Authorization: Bearer $TOKEN" -o /dev/null

    log_info "Testing POST attach without parameters (parameters is optional)"
    response=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/tools/$tool_namespace/$tool_name/guardrails" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"guardrailNamespace\": \"default\",
            \"guardrailName\": \"$TEST_GUARDRAIL_TOOL\",
            \"executionTiming\": \"post-execution\"
        }" \
        -w "\n%{http_code}")
    http_code=$(echo "$response" | tail -1)

    if [[ "$http_code" == "201" ]]; then
        log_pass "POST attach without parameters succeeded"
    else
        log_fail "POST attach without parameters expected 201, got $http_code"
    fi

    # Test 17: Verify null/empty parameters when not provided
    returned_params=$(echo "$response" | head -n -1 | jq -r '.parameters // "null"')
    if [[ "$returned_params" == "null" || -z "$returned_params" ]]; then
        log_pass "Parameters is null/empty when not provided"
    else
        log_fail "Parameters should be null when not provided, got '$returned_params'"
    fi

    # Clean up the test association
    curl -sk -X DELETE "${BACKSTAGE_URL}/api/mcp-entity-api/tools/$tool_namespace/$tool_name/guardrails/default/$TEST_GUARDRAIL_TOOL" \
        -H "Authorization: Bearer $TOKEN" -o /dev/null
}

# Test workload-tool-guardrail associations (T077 - Phase 6 US4)
test_workload_tool_guardrail_associations() {
    echo ""
    echo -e "${YELLOW}Test: Workload-Tool-Guardrail Associations (US4)${NC}"

    local http_code
    local response

    # First, we need a workload and a tool to test with
    log_info "Finding an existing workload and tool to test with..."

    # Get workloads
    response=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/workloads" -w "\n%{http_code}")
    http_code=$(echo "$response" | tail -1)

    if [[ "$http_code" != "200" ]]; then
        log_info "No workloads endpoint available (HTTP $http_code), skipping workload-tool-guardrail tests"
        return 0
    fi

    local workload_count
    workload_count=$(echo "$response" | head -n -1 | jq '.items | length')
    if [[ "$workload_count" == "0" || "$workload_count" == "null" ]]; then
        log_info "No workloads available, creating a test workload..."

        # Create a test workload
        local test_workload_name="test-workload-wtg-$$"
        http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/workloads" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "{
                \"metadata\": {\"name\": \"$test_workload_name\", \"namespace\": \"default\", \"description\": \"Test workload for WTG tests\"},
                \"spec\": {\"type\": \"mcp-workload\", \"lifecycle\": \"experimental\", \"owner\": \"user:default/admin\"}
            }" \
            -o /dev/null -w "%{http_code}")

        if [[ "$http_code" == "201" ]]; then
            log_pass "Created test workload: $test_workload_name"
            CREATED_GUARDRAILS+=("workload:$test_workload_name")  # Track for cleanup
        else
            log_info "Could not create test workload (HTTP $http_code), skipping workload-tool-guardrail tests"
            return 0
        fi

        local workload_namespace="default"
        local workload_name="$test_workload_name"
    else
        # Use existing workload
        local workload_namespace
        local workload_name
        workload_namespace=$(echo "$response" | head -n -1 | jq -r '.items[0].metadata.namespace // "default"')
        workload_name=$(echo "$response" | head -n -1 | jq -r '.items[0].metadata.name')
        log_pass "Found workload: $workload_namespace/$workload_name"
    fi

    # Get tools
    response=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/tools" -w "\n%{http_code}")
    http_code=$(echo "$response" | tail -1)

    if [[ "$http_code" != "200" ]]; then
        log_info "No tools endpoint available (HTTP $http_code), skipping workload-tool-guardrail tests"
        return 0
    fi

    local tool_count
    tool_count=$(echo "$response" | head -n -1 | jq '.items | length')
    if [[ "$tool_count" == "0" || "$tool_count" == "null" ]]; then
        log_info "No tools available in catalog, skipping workload-tool-guardrail tests"
        return 0
    fi

    local tool_namespace
    local tool_name
    tool_namespace=$(echo "$response" | head -n -1 | jq -r '.items[0].metadata.namespace // "default"')
    tool_name=$(echo "$response" | head -n -1 | jq -r '.items[0].metadata.name')
    log_pass "Found tool: $tool_namespace/$tool_name"

    # Test 1: GET /workloads/:wNs/:wName/tools/:tNs/:tName/guardrails - List guardrails (should be empty initially)
    log_info "Testing GET /workloads/$workload_namespace/$workload_name/tools/$tool_namespace/$tool_name/guardrails (list)"
    response=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/$workload_namespace/$workload_name/tools/$tool_namespace/$tool_name/guardrails" \
        -w "\n%{http_code}")
    http_code=$(echo "$response" | tail -1)

    if [[ "$http_code" == "200" ]]; then
        log_pass "GET /workloads/.../tools/.../guardrails returned 200 OK"
    else
        log_fail "GET /workloads/.../tools/.../guardrails expected 200, got $http_code"
    fi

    # Test 2: POST /workloads/.../tools/.../guardrails - Add guardrail to workload-tool
    log_info "Testing POST /workloads/.../tools/.../guardrails (add guardrail)"
    response=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/$workload_namespace/$workload_name/tools/$tool_namespace/$tool_name/guardrails" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"guardrailNamespace\": \"default\",
            \"guardrailName\": \"$TEST_GUARDRAIL_1\",
            \"executionTiming\": \"pre-execution\"
        }" \
        -w "\n%{http_code}")
    http_code=$(echo "$response" | tail -1)
    log_verbose "Add WTG response: $(echo "$response" | head -n -1)"

    if [[ "$http_code" == "201" ]]; then
        log_pass "POST /workloads/.../tools/.../guardrails returned 201 Created"
    else
        log_fail "POST /workloads/.../tools/.../guardrails expected 201, got $http_code"
    fi

    # Verify the association response has expected fields
    local assoc_id
    assoc_id=$(echo "$response" | head -n -1 | jq -r '.id')
    if [[ -n "$assoc_id" && "$assoc_id" != "null" ]]; then
        log_pass "Association response includes id field"
    else
        log_fail "Association response missing id field"
    fi

    local source
    source=$(echo "$response" | head -n -1 | jq -r '.source')
    if [[ "$source" == "workload" ]]; then
        log_pass "Association source is 'workload' (as expected for workload-level additions)"
    else
        log_fail "Association source expected 'workload', got $source"
    fi

    # Test 3: GET /workloads/.../tools/.../guardrails - Verify guardrail is attached
    log_info "Verifying guardrail is attached to workload-tool"
    response=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/$workload_namespace/$workload_name/tools/$tool_namespace/$tool_name/guardrails")
    local attached_count
    attached_count=$(echo "$response" | jq '.items | length')
    if [[ "$attached_count" -ge 1 ]]; then
        log_pass "Workload-tool has $attached_count guardrail(s) attached"
    else
        log_fail "Expected at least 1 guardrail attached, got $attached_count"
    fi

    # Test 4: POST duplicate attachment - should return 409
    log_info "Testing duplicate attachment (expecting 409)"
    http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/$workload_namespace/$workload_name/tools/$tool_namespace/$tool_name/guardrails" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"guardrailNamespace\": \"default\",
            \"guardrailName\": \"$TEST_GUARDRAIL_1\",
            \"executionTiming\": \"post-execution\"
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "409" ]]; then
        log_pass "Duplicate attachment returns 409 Conflict"
    else
        log_fail "Duplicate attachment expected 409, got $http_code"
    fi

    # Test 5: POST with invalid executionTiming - should return 400
    log_info "Testing invalid executionTiming (expecting 400)"
    http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/$workload_namespace/$workload_name/tools/$tool_namespace/$tool_name/guardrails" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"guardrailNamespace\": \"default\",
            \"guardrailName\": \"$TEST_GUARDRAIL_1\",
            \"executionTiming\": \"invalid-timing\"
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "400" ]]; then
        log_pass "Invalid executionTiming returns 400 Bad Request"
    else
        log_fail "Invalid executionTiming expected 400, got $http_code"
    fi

    # Test 6: POST with non-existent guardrail - should return 404
    log_info "Testing attachment of non-existent guardrail (expecting 404)"
    http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/$workload_namespace/$workload_name/tools/$tool_namespace/$tool_name/guardrails" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"guardrailNamespace\": \"default\",
            \"guardrailName\": \"non-existent-guardrail-xyz\",
            \"executionTiming\": \"pre-execution\"
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "404" ]]; then
        log_pass "Non-existent guardrail returns 404 Not Found"
    else
        log_fail "Non-existent guardrail expected 404, got $http_code"
    fi

    # Test 7: GET guardrails for non-existent workload - should return 404
    log_info "Testing GET guardrails for non-existent workload (expecting 404)"
    http_code=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/default/non-existent-workload-xyz/tools/$tool_namespace/$tool_name/guardrails" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "404" ]]; then
        log_pass "Non-existent workload returns 404 Not Found"
    else
        log_fail "Non-existent workload expected 404, got $http_code"
    fi

    # Test 8: DELETE /workloads/.../tools/.../guardrails/:gNs/:gName - Remove guardrail
    log_info "Testing DELETE /workloads/.../tools/.../guardrails/default/$TEST_GUARDRAIL_1 (remove)"
    http_code=$(curl -sk -X DELETE "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/$workload_namespace/$workload_name/tools/$tool_namespace/$tool_name/guardrails/default/$TEST_GUARDRAIL_1" \
        -H "Authorization: Bearer $TOKEN" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "204" ]]; then
        log_pass "DELETE /workloads/.../tools/.../guardrails/:gNs/:gName returned 204 No Content"
    else
        log_fail "DELETE /workloads/.../tools/.../guardrails expected 204, got $http_code"
    fi

    # Test 9: Verify guardrail is removed
    log_info "Verifying guardrail is removed"
    response=$(curl -sk "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/$workload_namespace/$workload_name/tools/$tool_namespace/$tool_name/guardrails")
    attached_count=$(echo "$response" | jq "[.items[] | select(.guardrail.name == \"$TEST_GUARDRAIL_1\")] | length")
    if [[ "$attached_count" == "0" ]]; then
        log_pass "Guardrail successfully removed"
    else
        log_fail "Guardrail still attached after removal"
    fi

    # Test 10: DELETE non-existent association - should return 404
    log_info "Testing DELETE non-existent association (expecting 404)"
    http_code=$(curl -sk -X DELETE "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/$workload_namespace/$workload_name/tools/$tool_namespace/$tool_name/guardrails/default/$TEST_GUARDRAIL_1" \
        -H "Authorization: Bearer $TOKEN" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "404" ]]; then
        log_pass "DELETE non-existent association returns 404 Not Found"
    else
        log_fail "DELETE non-existent association expected 404, got $http_code"
    fi

    # Test 11: POST without auth - should return 401
    log_info "Testing POST add without auth (expecting 401)"
    http_code=$(curl -sk -X POST "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/$workload_namespace/$workload_name/tools/$tool_namespace/$tool_name/guardrails" \
        -H "Content-Type: application/json" \
        -d "{
            \"guardrailNamespace\": \"default\",
            \"guardrailName\": \"$TEST_GUARDRAIL_1\",
            \"executionTiming\": \"pre-execution\"
        }" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "401" ]]; then
        log_pass "POST add without auth returns 401 Unauthorized"
    else
        log_fail "POST add without auth expected 401, got $http_code"
    fi

    # Test 12: DELETE without auth - should return 401
    log_info "Testing DELETE remove without auth (expecting 401)"
    http_code=$(curl -sk -X DELETE "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/$workload_namespace/$workload_name/tools/$tool_namespace/$tool_name/guardrails/default/$TEST_GUARDRAIL_1" \
        -o /dev/null -w "%{http_code}")

    if [[ "$http_code" == "401" ]]; then
        log_pass "DELETE remove without auth returns 401 Unauthorized"
    else
        log_fail "DELETE remove without auth expected 401, got $http_code"
    fi

    # Clean up test workload if we created one
    if [[ -n "${test_workload_name:-}" ]]; then
        log_info "Cleaning up test workload: $test_workload_name"
        curl -sk -X DELETE "${BACKSTAGE_URL}/api/mcp-entity-api/workloads/default/$test_workload_name" \
            -H "Authorization: Bearer $TOKEN" -o /dev/null
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
        log_info "Created guardrails: ${CREATED_GUARDRAILS[*]}"
        return
    fi

    for guardrail in "${CREATED_GUARDRAILS[@]}"; do
        if [[ -n "$guardrail" ]]; then
            log_info "Deleting: $guardrail"
            curl -sk -X DELETE "${BACKSTAGE_URL}/api/mcp-entity-api/guardrails/default/$guardrail" \
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

test_create_guardrail
test_import_guardrail
test_import_multi_guardrails
test_list_get_guardrail
test_update_rename_guardrail
test_disable_enable_guardrail
test_delete_guardrail
test_rbac
test_tool_guardrail_associations
test_workload_tool_guardrail_associations

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
    echo -e "${GREEN}|  ALL GUARDRAIL CRUD TESTS PASSED                              |${NC}"
    echo -e "${GREEN}+---------------------------------------------------------------+${NC}"
    exit 0
else
    echo -e "${RED}+---------------------------------------------------------------+${NC}"
    echo -e "${RED}|  SOME TESTS FAILED                                            |${NC}"
    echo -e "${RED}+---------------------------------------------------------------+${NC}"
    exit 1
fi
