#!/bin/bash
#
# Build and push the Backstage backend image to Quay.io
#
# Usage: ./build-and-push.sh <version-tag>
# Example: ./build-and-push.sh v5
#

set -e

# Configuration - update these for your environment
REGISTRY="${REGISTRY:-quay.io}"
ORG="${ORG:-jsalomon}"
IMAGE_NAME="${IMAGE_NAME:-backstage}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for required parameter
if [ -z "$1" ]; then
    echo -e "${RED}Error: Version tag is required${NC}"
    echo ""
    echo "Usage: $0 <version-tag>"
    echo "Example: $0 v5"
    exit 1
fi

VERSION_TAG="$1"
FULL_IMAGE="${REGISTRY}/${ORG}/${IMAGE_NAME}:${VERSION_TAG}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Building Backstage image: ${FULL_IMAGE}${NC}"
echo -e "${GREEN}========================================${NC}"

# Ensure we're in the backstage-app directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Step 1: Install dependencies
echo -e "\n${YELLOW}Step 1/5: Installing dependencies...${NC}"
yarn install --immutable

# Step 2: TypeScript compile
echo -e "\n${YELLOW}Step 2/5: Compiling TypeScript...${NC}"
yarn tsc

# Step 3: Build backend
echo -e "\n${YELLOW}Step 3/5: Building backend bundle...${NC}"
yarn build:backend

# Verify build artifacts exist
if [ ! -f "packages/backend/dist/bundle.tar.gz" ] || [ ! -f "packages/backend/dist/skeleton.tar.gz" ]; then
    echo -e "${RED}Error: Build artifacts not found in packages/backend/dist/${NC}"
    exit 1
fi
echo -e "${GREEN}Build artifacts verified ✓${NC}"

# Step 4: Build container image
echo -e "\n${YELLOW}Step 4/5: Building container image...${NC}"
podman build --no-cache -f packages/backend/Dockerfile -t "${FULL_IMAGE}" .

# Verify permissions are correct for OpenShift
echo -e "\n${YELLOW}Verifying /app permissions...${NC}"
PERMS=$(podman run --rm "${FULL_IMAGE}" stat -c "%a" /app)
if [ "$PERMS" != "755" ]; then
    echo -e "${RED}Warning: /app permissions are ${PERMS}, expected 755${NC}"
    echo -e "${RED}OpenShift may fail to run this image${NC}"
else
    echo -e "${GREEN}/app permissions are 755 ✓${NC}"
fi

# Step 5: Push to registry
echo -e "\n${YELLOW}Step 5/5: Pushing to registry...${NC}"
podman push "${FULL_IMAGE}"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Success! Image pushed: ${FULL_IMAGE}${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}To deploy to OpenShift:${NC}"
echo "  oc set image deployment/backstage backstage=${FULL_IMAGE} -n backstage"
echo "  oc delete pods -n backstage -l app=backstage"
echo ""
