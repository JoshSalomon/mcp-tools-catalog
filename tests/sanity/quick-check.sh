#!/bin/bash
#
# MCP Tools Catalog - Quick Health Check
#
# A fast check of system health (< 30 seconds)
# For full test suite, use run-sanity-tests.sh
#

set -o pipefail

# Configuration
BACKSTAGE_NAMESPACE="${BACKSTAGE_NAMESPACE:-backstage}"
PLUGIN_NAMESPACE="${PLUGIN_NAMESPACE:-mcp-tools-catalog}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${BOLD}MCP Tools Catalog - Quick Health Check${NC}"
echo "========================================"
echo ""

ISSUES=0

# Check 1: oc logged in
echo -n "1. OpenShift login... "
if oc whoami &>/dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC} - Not logged in"
    exit 1
fi

# Check 2: Backstage pods
echo -n "2. Backstage pods... "
BS_PODS=$(oc get pods -n $BACKSTAGE_NAMESPACE --no-headers 2>/dev/null | grep -c "Running" || echo "0")
if [[ "$BS_PODS" -gt 0 ]]; then
    echo -e "${GREEN}OK${NC} ($BS_PODS running)"
else
    echo -e "${RED}FAILED${NC} - No running pods"
    ((ISSUES++))
fi

# Check 3: Plugin pods
echo -n "3. Plugin pods... "
PLUGIN_PODS=$(oc get pods -n $PLUGIN_NAMESPACE -l app=mcp-catalog --no-headers 2>/dev/null | grep -c "Running" || echo "0")
if [[ "$PLUGIN_PODS" -gt 0 ]]; then
    echo -e "${GREEN}OK${NC} ($PLUGIN_PODS running)"
else
    echo -e "${RED}FAILED${NC} - No running pods"
    ((ISSUES++))
fi

# Check 4: Console pods
echo -n "4. Console pods... "
CONSOLE_PODS=$(oc get pods -n openshift-console -l app=console --no-headers 2>/dev/null | grep -c "Running" || echo "0")
if [[ "$CONSOLE_PODS" -gt 0 ]]; then
    echo -e "${GREEN}OK${NC} ($CONSOLE_PODS running)"
else
    echo -e "${RED}FAILED${NC} - No running pods"
    ((ISSUES++))
fi

# Check 5: Plugin registered
echo -n "5. Plugin registered... "
PLUGINS=$(oc get consoles.operator.openshift.io cluster -o jsonpath='{.spec.plugins}' 2>/dev/null)
if echo "$PLUGINS" | grep -q "mcp-catalog"; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC} - Not in console plugins"
    ((ISSUES++))
fi

# Check 6: ConsolePlugin CR
echo -n "6. ConsolePlugin CR... "
if oc get consoleplugin mcp-catalog &>/dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC} - CR not found"
    ((ISSUES++))
fi

# Check 7: Quick API test (with temp port-forward)
echo -n "7. Backstage API... "
oc port-forward -n $BACKSTAGE_NAMESPACE svc/backstage 17007:7007 &>/dev/null &
PF_PID=$!
sleep 2

if kill -0 $PF_PID 2>/dev/null; then
    ENTITY_COUNT=$(curl -s http://localhost:17007/api/catalog/entities 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
    kill $PF_PID 2>/dev/null
    if [[ "$ENTITY_COUNT" -gt 0 ]]; then
        echo -e "${GREEN}OK${NC} ($ENTITY_COUNT entities)"
    else
        echo -e "${YELLOW}WARN${NC} - API reachable but 0 entities"
    fi
else
    echo -e "${YELLOW}SKIP${NC} - Could not port-forward"
fi

# Summary
echo ""
echo "========================================"
if [[ "$ISSUES" -eq 0 ]]; then
    echo -e "${GREEN}${BOLD}✅ System appears healthy${NC}"
    echo ""
    echo "For detailed tests, run: ./run-sanity-tests.sh --verbose"
    exit 0
else
    echo -e "${RED}${BOLD}❌ $ISSUES issue(s) found${NC}"
    echo ""
    echo "For detailed diagnostics, run: ./run-sanity-tests.sh --verbose"
    exit 1
fi
