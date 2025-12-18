#!/bin/bash
# Push corrected image and update OpenShift deployment

set -e

# Load image configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/.image-config.sh" ]; then
    source "${SCRIPT_DIR}/.image-config.sh"
fi

echo "================================================"
echo "MCP Catalog - Push and Deploy Fixed Image"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Detect container runtime
if command -v podman &> /dev/null; then
    CONTAINER_CMD="podman"
elif command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
else
    echo "Error: Neither podman nor docker found"
    exit 1
fi

echo -e "${GREEN}Step 1: Pushing image to registry${NC}"
echo "Running: ${CONTAINER_CMD} push ${FULL_IMAGE}"
echo ""

${CONTAINER_CMD} push ${FULL_IMAGE}

echo ""
echo -e "${GREEN}✓ Image pushed successfully${NC}"
echo ""

echo "================================================"
echo -e "${GREEN}Step 2: Updating OpenShift deployment${NC}"
echo "Running: oc set image deployment/${DEPLOYMENT_NAME} ${DEPLOYMENT_NAME}=${FULL_IMAGE} -n ${OPENSHIFT_NAMESPACE}"
echo ""

oc set image deployment/${DEPLOYMENT_NAME} \
  ${DEPLOYMENT_NAME}=${FULL_IMAGE} \
  -n ${OPENSHIFT_NAMESPACE}

echo ""
echo -e "${GREEN}✓ Deployment updated${NC}"
echo ""

echo "================================================"
echo -e "${GREEN}Step 3: Forcing image reload${NC}"
echo ""

# Force reload by restarting deployment and adding annotation
TIMESTAMP=$(date +%s)
oc rollout restart deployment/${DEPLOYMENT_NAME} -n ${OPENSHIFT_NAMESPACE}
oc patch deployment/${DEPLOYMENT_NAME} -n ${OPENSHIFT_NAMESPACE} \
  -p "{\"spec\":{\"template\":{\"metadata\":{\"annotations\":{\"kubectl.kubernetes.io/restartedAt\":\"${TIMESTAMP}\"}}}}}" \
  --type=merge

# Delete pods to force recreation
oc delete pods -l app=${DEPLOYMENT_NAME} -n ${OPENSHIFT_NAMESPACE} --ignore-not-found=true

echo ""
echo -e "${GREEN}✓ Image reload triggered${NC}"
echo ""

echo "================================================"
echo -e "${GREEN}Step 4: Waiting for rollout to complete${NC}"
echo ""

oc rollout status deployment/${DEPLOYMENT_NAME} -n ${OPENSHIFT_NAMESPACE}

echo ""
echo -e "${GREEN}✓ Rollout complete${NC}"
echo ""

echo "================================================"
echo -e "${GREEN}Step 4: Verifying manifest in pod${NC}"
echo ""

# Get pod name
POD=$(oc get pods -n ${OPENSHIFT_NAMESPACE} -l app=${DEPLOYMENT_NAME} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -z "$POD" ]; then
    # Try without label selector
    POD=$(oc get pods -n ${OPENSHIFT_NAMESPACE} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
fi

if [ -n "$POD" ]; then
    echo "Checking plugin name in pod: $POD"
    PLUGIN_NAME=$(oc exec -n ${OPENSHIFT_NAMESPACE} $POD -- cat /usr/share/nginx/html/plugin-manifest.json 2>/dev/null | grep -o '"name":"[^"]*"' | cut -d'"' -f4)

    if [ "$PLUGIN_NAME" == "mcp-catalog" ]; then
        echo -e "${GREEN}✓ Manifest has CORRECT name: $PLUGIN_NAME${NC}"
    else
        echo -e "\033[0;31m✗ Manifest still has WRONG name: $PLUGIN_NAME (should be 'mcp-catalog')${NC}"
        echo "Something went wrong. Check if the image was pushed correctly."
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ Could not find pod to verify${NC}"
fi

echo ""
echo "================================================"
echo -e "${GREEN}Step 5: Force console to reload${NC}"
echo ""

oc delete pods -n openshift-console -l app=console

echo ""
echo -e "${GREEN}✓ Console pods deleted${NC}"
echo ""

echo "================================================"
echo "DEPLOYMENT COMPLETE!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Wait 2-3 minutes for console pods to restart"
echo "2. Hard refresh your browser: Ctrl+Shift+R (or Cmd+Shift+R on Mac)"
echo "3. Clear browser cache if needed"
echo "4. Check browser console (F12) - the plugin-manifest.json should now show 'mcp-catalog'"
echo ""
echo "The MCP Catalog should now appear in the OpenShift Console!"
echo ""
