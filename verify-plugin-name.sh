#!/bin/bash
set -e

# Script to verify and fix plugin name in manifest

# Load image configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/.image-config.sh" ]; then
    source "${SCRIPT_DIR}/.image-config.sh"
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== MCP Catalog Plugin Name Verification ===${NC}"
echo ""

# Check source configuration
echo -e "${YELLOW}1. Checking source configuration...${NC}"
SOURCE_NAME=$(grep -A 2 '"consolePlugin"' package.json | grep '"name"' | sed 's/.*"name": *"\([^"]*\)".*/\1/')
if [ "$SOURCE_NAME" = "mcp-catalog" ]; then
    echo -e "${GREEN}   ✅ Source name is correct: $SOURCE_NAME${NC}"
else
    echo -e "${RED}   ❌ Source name is wrong: $SOURCE_NAME (should be mcp-catalog)${NC}"
    exit 1
fi

# Check built manifest (if exists)
if [ -f "dist/plugin-manifest.json" ]; then
    echo -e "${YELLOW}2. Checking built manifest...${NC}"
    BUILT_NAME=$(cat dist/plugin-manifest.json | jq -r '.name' 2>/dev/null || grep -o '"name":"[^"]*"' dist/plugin-manifest.json | sed 's/"name":"\([^"]*\)"/\1/')
    if [ "$BUILT_NAME" = "mcp-catalog" ]; then
        echo -e "${GREEN}   ✅ Built manifest name is correct: $BUILT_NAME${NC}"
    else
        echo -e "${RED}   ❌ Built manifest name is wrong: $BUILT_NAME (should be mcp-catalog)${NC}"
        echo -e "${YELLOW}   → Run: yarn build${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}2. No built manifest found (dist/plugin-manifest.json)${NC}"
    echo -e "${YELLOW}   → Run: yarn build${NC}"
fi

# Check deployed container (if OpenShift is available)
if command -v oc &> /dev/null; then
    echo -e "${YELLOW}3. Checking deployed container...${NC}"
    if oc get pods -n ${OPENSHIFT_NAMESPACE} &> /dev/null; then
        POD=$(oc get pods -n ${OPENSHIFT_NAMESPACE} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
        if [ -n "$POD" ]; then
            DEPLOYED_NAME=$(oc exec -n ${OPENSHIFT_NAMESPACE} $POD -- cat /usr/share/nginx/html/plugin-manifest.json 2>/dev/null | jq -r '.name' 2>/dev/null || echo "error")
            if [ "$DEPLOYED_NAME" = "mcp-catalog" ]; then
                echo -e "${GREEN}   ✅ Deployed manifest name is correct: $DEPLOYED_NAME${NC}"
            elif [ "$DEPLOYED_NAME" = "error" ]; then
                echo -e "${YELLOW}   ⚠️  Could not read manifest from pod${NC}"
            else
                echo -e "${RED}   ❌ Deployed manifest name is wrong: $DEPLOYED_NAME (should be mcp-catalog)${NC}"
                echo -e "${YELLOW}   → You need to rebuild and redeploy the container${NC}"
                echo ""
                echo -e "${YELLOW}   Run these commands:${NC}"
                echo "   ./build-container.sh --local"
                echo "   podman push ${FULL_IMAGE}"
                echo "   oc set image deployment/${DEPLOYMENT_NAME} ${DEPLOYMENT_NAME}=${FULL_IMAGE} -n ${OPENSHIFT_NAMESPACE}"
                exit 1
            fi
        else
            echo -e "${YELLOW}   ⚠️  No pods found in ${OPENSHIFT_NAMESPACE} namespace${NC}"
        fi
    else
        echo -e "${YELLOW}   ⚠️  Not connected to OpenShift cluster${NC}"
    fi
else
    echo -e "${YELLOW}3. oc command not found, skipping deployed container check${NC}"
fi

echo ""
echo -e "${GREEN}=== Verification Complete ===${NC}"
echo ""
echo "If you need to rebuild:"
echo "  1. yarn build"
echo "  2. ./build-container.sh --local"
echo "  3. podman push ${FULL_IMAGE}"
echo "  4. oc set image deployment/${DEPLOYMENT_NAME} ${DEPLOYMENT_NAME}=${FULL_IMAGE} -n ${OPENSHIFT_NAMESPACE}"






