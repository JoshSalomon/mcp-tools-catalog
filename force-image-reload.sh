#!/bin/bash
# Force OpenShift to pull the latest image (even with :latest tag)
# This script uses multiple methods to ensure the image is pulled fresh

set -e

# Load image configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/.image-config.sh" ]; then
    source "${SCRIPT_DIR}/.image-config.sh"
fi

# Default values if not in config
DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-mcp-catalog}"
NAMESPACE="${OPENSHIFT_NAMESPACE:-mcp-tools-catalog}"
IMAGE="${FULL_IMAGE:-quay.io/jsalomon/mcp-tools-catalog:latest}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "================================================"
echo "Force Image Reload for ${DEPLOYMENT_NAME}"
echo "================================================"
echo ""
echo "Deployment: ${DEPLOYMENT_NAME}"
echo "Namespace: ${NAMESPACE}"
echo "Image: ${IMAGE}"
echo ""

# Method 1: Restart deployment (recommended - cleanest)
echo -e "${GREEN}Method 1: Restarting deployment${NC}"
oc rollout restart deployment/${DEPLOYMENT_NAME} -n ${NAMESPACE}
echo ""

# Method 2: Patch deployment with annotation to force update
echo -e "${GREEN}Method 2: Adding restart annotation${NC}"
TIMESTAMP=$(date +%s)
oc patch deployment/${DEPLOYMENT_NAME} -n ${NAMESPACE} \
  -p "{\"spec\":{\"template\":{\"metadata\":{\"annotations\":{\"kubectl.kubernetes.io/restartedAt\":\"${TIMESTAMP}\"}}}}}" \
  --type=merge
echo ""

# Method 3: Set image again to trigger update (even if same)
echo -e "${GREEN}Method 3: Re-setting image reference${NC}"
oc set image deployment/${DEPLOYMENT_NAME} ${DEPLOYMENT_NAME}=${IMAGE} -n ${NAMESPACE}
echo ""

# Method 4: Delete existing pods to force recreation
echo -e "${GREEN}Method 4: Deleting existing pods${NC}"
oc delete pods -l app=${DEPLOYMENT_NAME} -n ${NAMESPACE} --ignore-not-found=true
echo ""

# Wait for rollout
echo -e "${GREEN}Waiting for rollout to complete...${NC}"
if oc rollout status deployment/${DEPLOYMENT_NAME} -n ${NAMESPACE} --timeout=5m; then
    echo -e "${GREEN}✓ Rollout successful${NC}"
else
    echo -e "${RED}✗ Rollout failed or timed out${NC}"
    exit 1
fi
echo ""

# Verify pods are running
echo -e "${GREEN}Checking pod status...${NC}"
oc get pods -l app=${DEPLOYMENT_NAME} -n ${NAMESPACE}
echo ""

# Check image actually pulled
echo -e "${GREEN}Verifying image was pulled...${NC}"
POD=$(oc get pods -l app=${DEPLOYMENT_NAME} -n ${NAMESPACE} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ -n "$POD" ]; then
    ACTUAL_IMAGE=$(oc get pod ${POD} -n ${NAMESPACE} -o jsonpath='{.spec.containers[0].image}')
    echo "Pod: ${POD}"
    echo "Image: ${ACTUAL_IMAGE}"
    
    # Check if image pull policy is correct
    PULL_POLICY=$(oc get pod ${POD} -n ${NAMESPACE} -o jsonpath='{.spec.containers[0].imagePullPolicy}')
    echo "Pull Policy: ${PULL_POLICY}"
    
    if [ "$PULL_POLICY" != "Always" ]; then
        echo -e "${YELLOW}⚠ Warning: imagePullPolicy is not 'Always'. Updating deployment...${NC}"
        oc patch deployment/${DEPLOYMENT_NAME} -n ${NAMESPACE} \
          -p '{"spec":{"template":{"spec":{"containers":[{"name":"'${DEPLOYMENT_NAME}'","imagePullPolicy":"Always"}]}}}}'
        oc rollout restart deployment/${DEPLOYMENT_NAME} -n ${NAMESPACE}
        oc rollout status deployment/${DEPLOYMENT_NAME} -n ${NAMESPACE} --timeout=5m
    fi
else
    echo -e "${YELLOW}⚠ Could not find pod${NC}"
fi

echo ""
echo "================================================"
echo -e "${GREEN}Image reload complete!${NC}"
echo "================================================"
echo ""
echo "If the image still isn't updating, try:"
echo "1. Use a unique tag instead of :latest (e.g., :$(date +%Y%m%d-%H%M%S))"
echo "2. Check registry: podman pull ${IMAGE}"
echo "3. Verify imagePullPolicy is 'Always' in deployment"
echo ""
