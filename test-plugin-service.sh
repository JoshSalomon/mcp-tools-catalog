#!/bin/bash
# Test MCP Catalog Plugin Service Accessibility
# This checks if the plugin's manifest and JavaScript files are being served correctly

set -e

# Load image configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/.image-config.sh" ]; then
    source "${SCRIPT_DIR}/.image-config.sh"
fi

echo "================================================"
echo "MCP Catalog Plugin Service Test"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_pass() { echo -e "${GREEN}✓${NC} $1"; }
check_fail() { echo -e "${RED}✗${NC} $1"; }
check_warn() { echo -e "${YELLOW}⚠${NC} $1"; }

# Get service details
echo "Getting service details..."
SVC_NAME=$(oc get svc -n ${OPENSHIFT_NAMESPACE} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
SVC_PORT=$(oc get svc -n ${OPENSHIFT_NAMESPACE} -o jsonpath='{.items[0].spec.ports[0].port}' 2>/dev/null)

if [ -z "$SVC_NAME" ]; then
    check_fail "No service found in ${OPENSHIFT_NAMESPACE} namespace!"
    echo "Run: oc get svc -n ${OPENSHIFT_NAMESPACE}"
    exit 1
fi

echo "Service: $SVC_NAME"
echo "Port: $SVC_PORT"
echo ""

# Get ConsolePlugin details
echo "Getting ConsolePlugin configuration..."
PLUGIN_SVC=$(oc get consoleplugin mcp-catalog -o jsonpath='{.spec.service.name}' 2>/dev/null)
PLUGIN_PORT=$(oc get consoleplugin mcp-catalog -o jsonpath='{.spec.service.port}' 2>/dev/null)
PLUGIN_BASEPATH=$(oc get consoleplugin mcp-catalog -o jsonpath='{.spec.service.basePath}' 2>/dev/null)

echo "ConsolePlugin service: $PLUGIN_SVC"
echo "ConsolePlugin port: $PLUGIN_PORT"
echo "ConsolePlugin basePath: $PLUGIN_BASEPATH"
echo ""

# Test 1: Check if pods are running
echo "================================================"
echo "Test 1: Checking Pod Status"
echo "================================================"
POD_NAME=$(oc get pods -n ${OPENSHIFT_NAMESPACE} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
POD_STATUS=$(oc get pods -n ${OPENSHIFT_NAMESPACE} -o jsonpath='{.items[0].status.phase}' 2>/dev/null)

if [ "$POD_STATUS" == "Running" ]; then
    check_pass "Pod is running: $POD_NAME"
else
    check_fail "Pod is not running: $POD_STATUS"
    exit 1
fi
echo ""

# Test 2: Check service endpoint from inside cluster
echo "================================================"
echo "Test 2: Testing Service from Inside Cluster"
echo "================================================"

SERVICE_URL="https://$SVC_NAME.$PROJECT.svc:$SVC_PORT"
echo "Testing: $SERVICE_URL/plugin-manifest.json"
echo ""

# Try to curl the manifest from inside the cluster
MANIFEST_TEST=$(oc exec -n ${OPENSHIFT_NAMESPACE} $POD_NAME -- curl -k -s -o /dev/null -w "%{http_code}" "https://$SVC_NAME:$SVC_PORT/plugin-manifest.json" 2>/dev/null || echo "FAILED")

if [ "$MANIFEST_TEST" == "200" ]; then
    check_pass "Plugin manifest is accessible (HTTP 200)"

    # Get and display the manifest
    echo ""
    echo "Manifest content:"
    oc exec -n ${OPENSHIFT_NAMESPACE} $POD_NAME -- curl -k -s "https://$SVC_NAME:$SVC_PORT/plugin-manifest.json" 2>/dev/null | head -20
elif [ "$MANIFEST_TEST" == "404" ]; then
    check_fail "Plugin manifest not found (HTTP 404)"
    echo "The manifest file might not be in the correct location"
    echo "Check if dist/plugin-manifest.json exists in your build"
elif [ "$MANIFEST_TEST" == "000" ] || [ "$MANIFEST_TEST" == "FAILED" ]; then
    check_fail "Cannot connect to service"
    echo "Service might not be running or certificates are invalid"
else
    check_warn "Unexpected response: HTTP $MANIFEST_TEST"
fi
echo ""

# Test 3: Check if files exist in pod
echo "================================================"
echo "Test 3: Checking Files in Pod"
echo "================================================"
echo "Listing files in /usr/share/nginx/html:"
oc exec -n ${OPENSHIFT_NAMESPACE} $POD_NAME -- ls -lh /usr/share/nginx/html/ 2>/dev/null | head -20

echo ""
echo "Checking for plugin-manifest.json:"
if oc exec -n ${OPENSHIFT_NAMESPACE} $POD_NAME -- test -f /usr/share/nginx/html/plugin-manifest.json 2>/dev/null; then
    check_pass "plugin-manifest.json exists"
    echo "Content:"
    oc exec -n ${OPENSHIFT_NAMESPACE} $POD_NAME -- cat /usr/share/nginx/html/plugin-manifest.json 2>/dev/null
else
    check_fail "plugin-manifest.json NOT FOUND"
    echo "The build might not have included the manifest file"
fi
echo ""

# Test 4: Check nginx logs
echo "================================================"
echo "Test 4: Checking NGINX Logs"
echo "================================================"
echo "Recent nginx access logs:"
oc logs -n ${OPENSHIFT_NAMESPACE} $POD_NAME --tail=10 2>/dev/null || echo "No logs available"
echo ""

# Test 5: Test from console namespace
echo "================================================"
echo "Test 5: Testing from Console Namespace"
echo "================================================"
CONSOLE_POD=$(oc get pods -n openshift-console -l app=console -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -n "$CONSOLE_POD" ]; then
    echo "Testing from console pod: $CONSOLE_POD"
    echo "URL: https://$SVC_NAME.${OPENSHIFT_NAMESPACE}.svc:$SVC_PORT/plugin-manifest.json"

    CONSOLE_TEST=$(oc exec -n openshift-console $CONSOLE_POD -- curl -k -s -o /dev/null -w "%{http_code}" "https://$SVC_NAME.${OPENSHIFT_NAMESPACE}.svc:$SVC_PORT/plugin-manifest.json" 2>/dev/null || echo "FAILED")

    if [ "$CONSOLE_TEST" == "200" ]; then
        check_pass "Console can reach plugin service (HTTP 200)"
    else
        check_fail "Console cannot reach plugin service (HTTP $CONSOLE_TEST)"
        echo "Network policy or service routing issue"
    fi
else
    check_warn "Cannot find console pod to test from"
fi
echo ""

# Test 6: Check ConsolePlugin spec
echo "================================================"
echo "Test 6: Verifying ConsolePlugin Configuration"
echo "================================================"
echo "Full ConsolePlugin spec:"
oc get consoleplugin mcp-catalog -o yaml
echo ""

# Summary
echo "================================================"
echo "SUMMARY"
echo "================================================"
echo ""
echo "If plugin-manifest.json is accessible (HTTP 200) but plugin doesn't appear:"
echo ""
echo "1. Check browser console (F12) for JavaScript errors:"
echo "   - Look for 'Failed to load plugin' or 'chunk load failed' errors"
echo "   - Look for CORS errors"
echo ""
echo "2. Clear browser cache completely:"
echo "   - Chrome/Edge: Ctrl+Shift+Delete, select 'All time', check 'Cached images and files'"
echo "   - Firefox: Ctrl+Shift+Delete, select 'Everything', check 'Cache'"
echo "   - Or use Incognito/Private mode"
echo ""
echo "3. Force console to reload plugins:"
echo "   oc delete pods -n openshift-console -l app=console"
echo ""
echo "4. Check console operator logs:"
echo "   oc logs -n openshift-console-operator deployment/console-operator | grep -i mcp-catalog"
echo ""
echo "5. If manifest shows wrong plugin name, rebuild and redeploy"
echo ""

# Check if manifest has correct plugin name
echo "Checking if manifest has correct plugin name..."
MANIFEST_NAME=$(oc exec -n ${OPENSHIFT_NAMESPACE} $POD_NAME -- cat /usr/share/nginx/html/plugin-manifest.json 2>/dev/null | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ "$MANIFEST_NAME" == "mcp-catalog" ]; then
    check_pass "Manifest has correct plugin name: $MANIFEST_NAME"
else
    check_fail "Manifest has WRONG plugin name: $MANIFEST_NAME (should be 'mcp-catalog')"
    echo ""
    echo "You need to rebuild with the correct name:"
    echo "  1. Ensure package.json has 'name': 'mcp-catalog'"
    echo "  2. Run: yarn build"
    echo "  3. Run: ./build-container.sh --local"
    echo "  4. Run: ${CONTAINER_CMD:-podman} push ${FULL_IMAGE}"
    echo "  5. Run: oc set image deployment/${DEPLOYMENT_NAME} ${DEPLOYMENT_NAME}=${FULL_IMAGE} -n ${OPENSHIFT_NAMESPACE}"
fi
"
fi
