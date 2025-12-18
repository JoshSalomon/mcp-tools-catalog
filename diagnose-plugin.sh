#!/bin/bash
# MCP Catalog Plugin Diagnostic Script
# This script checks why the MCP Catalog plugin isn't appearing in OpenShift Console

set -e

# Load image configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/.image-config.sh" ]; then
    source "${SCRIPT_DIR}/.image-config.sh"
fi

echo "================================================"
echo "MCP Catalog Plugin Diagnostic Script"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

section() {
    echo ""
    echo "================================================"
    echo "$1"
    echo "================================================"
}

# Check 1: Verify namespace exists
section "1. Checking Namespace"
if oc get namespace ${OPENSHIFT_NAMESPACE} &>/dev/null; then
    check_pass "Namespace '${OPENSHIFT_NAMESPACE}' exists"
else
    check_fail "Namespace '${OPENSHIFT_NAMESPACE}' does NOT exist"
    echo "Run: oc new-project ${OPENSHIFT_NAMESPACE}"
    exit 1
fi

# Check 2: Verify deployment exists and is running
section "2. Checking Deployment"
if oc get deployment -n ${OPENSHIFT_NAMESPACE} &>/dev/null; then
    DEPLOY_NAME=$(oc get deployment -n ${OPENSHIFT_NAMESPACE} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [ -n "$DEPLOY_NAME" ]; then
        check_pass "Found deployment: $DEPLOY_NAME"

        # Check replicas
        DESIRED=$(oc get deployment/$DEPLOY_NAME -n ${OPENSHIFT_NAMESPACE} -o jsonpath='{.spec.replicas}')
        READY=$(oc get deployment/$DEPLOY_NAME -n ${OPENSHIFT_NAMESPACE} -o jsonpath='{.status.readyReplicas}')

        if [ "$READY" == "$DESIRED" ] && [ "$READY" != "0" ]; then
            check_pass "Deployment is ready: $READY/$DESIRED replicas"
        else
            check_fail "Deployment is NOT ready: ${READY:-0}/$DESIRED replicas"
            echo "Check pods: oc get pods -n ${OPENSHIFT_NAMESPACE}"
        fi
    else
        check_fail "No deployment found in namespace"
        echo "You need to install via Helm first!"
        exit 1
    fi
else
    check_fail "Cannot access deployments in ${OPENSHIFT_NAMESPACE} namespace"
    exit 1
fi

# Check 3: Verify pods are running
section "3. Checking Pods"
POD_COUNT=$(oc get pods -n ${OPENSHIFT_NAMESPACE} --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
if [ "$POD_COUNT" -gt 0 ]; then
    check_pass "$POD_COUNT pod(s) running"
    oc get pods -n ${OPENSHIFT_NAMESPACE}
else
    check_fail "No running pods found"
    echo ""
    echo "All pods:"
    oc get pods -n ${OPENSHIFT_NAMESPACE}
    echo ""
    echo "Check pod details:"
    echo "  oc describe pod -n ${OPENSHIFT_NAMESPACE}"
    echo "  oc logs -n ${OPENSHIFT_NAMESPACE} deployment/$DEPLOY_NAME"
fi

# Check 4: Verify ConsolePlugin resource exists
section "4. Checking ConsolePlugin Registration"
if oc get consoleplugin mcp-catalog &>/dev/null; then
    check_pass "ConsolePlugin 'mcp-catalog' is registered"
    echo ""
    echo "ConsolePlugin details:"
    oc get consoleplugin mcp-catalog -o yaml | grep -A5 "spec:"
else
    check_fail "ConsolePlugin 'mcp-catalog' is NOT registered"
    echo ""
    echo "Available console plugins:"
    oc get consoleplugin
    echo ""
    echo "The Helm chart should have created this. Check Helm deployment:"
    echo "  helm list -n ${OPENSHIFT_NAMESPACE}"
    exit 1
fi

# Check 5: Verify console operator has enabled the plugin
section "5. Checking Console Operator Configuration"
ENABLED_PLUGINS=$(oc get consoles.operator.openshift.io cluster -o jsonpath='{.spec.plugins}' 2>/dev/null)

if echo "$ENABLED_PLUGINS" | grep -q "mcp-catalog"; then
    check_pass "Plugin 'mcp-catalog' is enabled in console operator"
else
    check_fail "Plugin 'mcp-catalog' is NOT enabled in console operator"
    echo ""
    echo "Currently enabled plugins:"
    echo "$ENABLED_PLUGINS" | jq -r '.[]' 2>/dev/null || echo "$ENABLED_PLUGINS"
    echo ""
    echo "TO FIX: Enable the plugin with:"
    echo "  oc patch consoles.operator.openshift.io cluster \\"
    echo "    --patch '{\"spec\":{\"plugins\":[\"mcp-catalog\"]}}' \\"
    echo "    --type=merge"
    echo ""
    echo "Note: This will ADD mcp-catalog to existing plugins"
    exit 1
fi

# Check 6: Verify service exists
section "6. Checking Service"
if oc get service -n ${OPENSHIFT_NAMESPACE} &>/dev/null; then
    SVC_NAME=$(oc get service -n ${OPENSHIFT_NAMESPACE} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [ -n "$SVC_NAME" ]; then
        check_pass "Service exists: $SVC_NAME"
        PORT=$(oc get service/$SVC_NAME -n ${OPENSHIFT_NAMESPACE} -o jsonpath='{.spec.ports[0].port}')
        TARGET_PORT=$(oc get service/$SVC_NAME -n ${OPENSHIFT_NAMESPACE} -o jsonpath='{.spec.ports[0].targetPort}')
        echo "  Port: $PORT -> $TARGET_PORT"
    fi
else
    check_warn "No service found (this might be okay depending on setup)"
fi

# Check 7: Check console operator status
section "7. Checking Console Operator Status"
CONSOLE_STATUS=$(oc get co console -o jsonpath='{.status.conditions[?(@.type=="Available")].status}' 2>/dev/null)
if [ "$CONSOLE_STATUS" == "True" ]; then
    check_pass "Console operator is available"
else
    check_fail "Console operator status: $CONSOLE_STATUS"
    echo "Check console operator:"
    echo "  oc get co console"
    echo "  oc logs -n openshift-console-operator deployment/console-operator"
fi

# Check 8: Check for console pods
section "8. Checking Console Pods"
CONSOLE_POD_COUNT=$(oc get pods -n openshift-console -l app=console --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
if [ "$CONSOLE_POD_COUNT" -gt 0 ]; then
    check_pass "$CONSOLE_POD_COUNT console pod(s) running"
else
    check_warn "No running console pods found - console may be restarting"
    oc get pods -n openshift-console -l app=console
fi

# Check 9: Look for errors in console logs
section "9. Checking Console Logs for Plugin Errors"
echo "Searching for plugin-related errors in console logs..."
echo ""
CONSOLE_POD=$(oc get pods -n openshift-console -l app=console -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ -n "$CONSOLE_POD" ]; then
    if oc logs -n openshift-console $CONSOLE_POD --tail=100 2>/dev/null | grep -i "mcp-catalog\|plugin.*error\|plugin.*failed" | tail -10; then
        check_warn "Found potential plugin errors (see above)"
    else
        check_pass "No obvious plugin errors in recent console logs"
    fi
else
    check_warn "Could not find console pod to check logs"
fi

# Check 10: Verify plugin service is accessible
section "10. Checking Plugin Service Accessibility"
if [ -n "$SVC_NAME" ]; then
    POD_NAME=$(oc get pods -n ${OPENSHIFT_NAMESPACE} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [ -n "$POD_NAME" ]; then
        echo "Testing plugin service endpoint from within cluster..."
        if oc exec -n ${OPENSHIFT_NAMESPACE} $POD_NAME -- curl -k -s -o /dev/null -w "%{http_code}" https://$SVC_NAME:9443 2>/dev/null | grep -q "200\|404"; then
            check_pass "Plugin service is responding"
        else
            check_warn "Plugin service may not be responding correctly"
        fi
    fi
fi

# Summary and recommendations
section "SUMMARY"
echo ""
echo "Diagnostic check complete!"
echo ""
echo "If the plugin still doesn't appear, try these steps:"
echo ""
echo "1. Force console to reload the plugins:"
echo "   oc delete pods -n openshift-console -l app=console"
echo ""
echo "2. Wait a few minutes for console pods to restart, then refresh your browser"
echo ""
echo "3. Clear browser cache and hard refresh (Ctrl+Shift+R / Cmd+Shift+R)"
echo ""
echo "4. Check console operator logs:"
echo "   oc logs -n openshift-console-operator deployment/console-operator | grep -i plugin"
echo ""
echo "5. Verify the ConsolePlugin manifest:"
echo "   oc get consoleplugin mcp-catalog -o yaml"
echo ""
echo "6. Check if manifest.json is accessible:"
echo "   oc get consoleplugin mcp-catalog -o jsonpath='{.spec.service}'"
echo ""

# Save details to file
REPORT_FILE="/tmp/mcp-plugin-diagnostic-$(date +%Y%m%d-%H%M%S).txt"
{
    echo "MCP Catalog Plugin Diagnostic Report"
    echo "Generated: $(date)"
    echo "====================================="
    echo ""
    echo "Namespace: ${OPENSHIFT_NAMESPACE}"
    echo "Deployment: $DEPLOY_NAME"
    echo "Service: $SVC_NAME"
    echo "Console Status: $CONSOLE_STATUS"
    echo "Enabled Plugins: $ENABLED_PLUGINS"
    echo ""
    echo "Deployment Status:"
    oc get deployment -n ${OPENSHIFT_NAMESPACE}
    echo ""
    echo "Pod Status:"
    oc get pods -n ${OPENSHIFT_NAMESPACE}
    echo ""
    echo "ConsolePlugin:"
    oc get consoleplugin mcp-catalog -o yaml
} > "$REPORT_FILE"

echo "Detailed report saved to: $REPORT_FILE"
echo ""
