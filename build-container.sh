#!/bin/bash
set -e

# Container image build script for MCP Tools Catalog
# This script provides multiple build strategies to handle network connectivity issues

# Load image configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/.image-config.sh" ]; then
    source "${SCRIPT_DIR}/.image-config.sh"
fi

# Configuration (use environment variables with defaults, compatible with .image-config.sh)
REGISTRY=${IMAGE_REGISTRY:-${REGISTRY:-"quay.io"}}
ORG=${IMAGE_ORG:-${ORG:-"your-org"}}
IMAGE_NAME=${IMAGE_NAME:-"mcp-tools-catalog"}
TAG=${IMAGE_TAG:-${TAG:-"latest"}}
FULL_IMAGE=${FULL_IMAGE:-"${REGISTRY}/${ORG}/${IMAGE_NAME}:${TAG}"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect container runtime
if command -v podman &> /dev/null; then
    CONTAINER_CMD="podman"
elif command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
else
    echo -e "${RED}Error: Neither podman nor docker found${NC}"
    exit 1
fi

echo -e "${GREEN}Using container runtime: ${CONTAINER_CMD}${NC}"

# Function to build locally then use Dockerfile.local
build_local() {
    echo -e "${YELLOW}=== Building with local build strategy ===${NC}"
    echo "This builds the application locally first, then copies artifacts to the container"
    echo ""

    # Build the Backstage plugin
    echo -e "${GREEN}Step 1: Building Backstage plugin...${NC}"
    cd plugins/mcp-tools-catalog

    if [ ! -d "node_modules" ]; then
        echo "Installing plugin dependencies..."
        yarn install
    fi

    echo "Generating TypeScript declarations..."
    yarn tsc

    echo "Building plugin..."
    yarn build

    cd ../..

    # Build the OpenShift Console plugin
    echo -e "${GREEN}Step 2: Building OpenShift Console plugin...${NC}"

    if [ ! -d "node_modules" ]; then
        echo "Installing root dependencies..."
        yarn install
    fi

    echo "Building console plugin..."
    yarn build

    # Build container image
    echo -e "${GREEN}Step 3: Building container image...${NC}"
    ${CONTAINER_CMD} build -f Dockerfile.local -t "${FULL_IMAGE}" .

    echo -e "${GREEN}✓ Build complete!${NC}"
    echo "Image: ${FULL_IMAGE}"
}

# Function to build using standard Dockerfile
build_standard() {
    echo -e "${YELLOW}=== Building with standard Dockerfile ===${NC}"
    echo "This builds everything inside the container"
    echo ""

    echo -e "${GREEN}Building container image...${NC}"
    ${CONTAINER_CMD} build -t "${FULL_IMAGE}" .

    echo -e "${GREEN}✓ Build complete!${NC}"
    echo "Image: ${FULL_IMAGE}"
}

# Function to build with IPv4 preference
build_ipv4() {
    echo -e "${YELLOW}=== Building with IPv4 preference ===${NC}"
    echo "This forces the build to use IPv4 networking"
    echo ""

    echo -e "${GREEN}Building container image with --network=host...${NC}"
    ${CONTAINER_CMD} build --network=host -t "${FULL_IMAGE}" .

    echo -e "${GREEN}✓ Build complete!${NC}"
    echo "Image: ${FULL_IMAGE}"
}

# Main menu
show_menu() {
    echo ""
    echo -e "${GREEN}MCP Tools Catalog Container Build Script${NC}"
    echo "=========================================="
    echo "Image will be tagged as: ${FULL_IMAGE}"
    echo ""
    echo "Build strategies:"
    echo "  1) Local build (RECOMMENDED - avoids network issues)"
    echo "  2) Standard Dockerfile build"
    echo "  3) Standard build with IPv4 preference"
    echo "  4) Exit"
    echo ""
    read -p "Select build strategy (1-4): " choice

    case $choice in
        1)
            build_local
            ;;
        2)
            build_standard
            ;;
        3)
            build_ipv4
            ;;
        4)
            echo "Exiting..."
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            show_menu
            ;;
    esac
}

# Check if running with arguments
if [ $# -gt 0 ]; then
    case "$1" in
        --local|-l)
            build_local
            ;;
        --standard|-s)
            build_standard
            ;;
        --ipv4|-4)
            build_ipv4
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --local, -l       Build locally then copy artifacts (recommended)"
            echo "  --standard, -s    Use standard Dockerfile"
            echo "  --ipv4, -4        Use standard Dockerfile with IPv4 preference"
            echo "  --help, -h        Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  REGISTRY          Container registry (default: quay.io)"
            echo "  ORG               Organization name (default: your-org)"
            echo "  IMAGE_NAME        Image name (default: mcp-tools-catalog)"
            echo "  TAG               Image tag (default: latest)"
            echo ""
            echo "Example:"
            echo "  REGISTRY=quay.io ORG=myorg ./build-container.sh --local"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
else
    show_menu
fi

# Offer to push the image
echo ""
read -p "Do you want to push the image to ${REGISTRY}? (y/N): " push_choice
if [[ $push_choice =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Pushing image...${NC}"
    ${CONTAINER_CMD} push "${FULL_IMAGE}"
    echo -e "${GREEN}✓ Push complete!${NC}"
else
    echo "Skipping push. To push later, run:"
    echo "  ${CONTAINER_CMD} push ${FULL_IMAGE}"
fi

echo ""
echo -e "${GREEN}All done!${NC}"
echo ""
echo "Next steps:"
echo "  1. Update your OpenShift deployment to use the new image"
OPENSHIFT_NAMESPACE=${OPENSHIFT_NAMESPACE:-"mcp-tools-catalog"}
DEPLOYMENT_NAME=${DEPLOYMENT_NAME:-"mcp-catalog"}
echo "  2. Run: oc set image deployment/${DEPLOYMENT_NAME} ${DEPLOYMENT_NAME}=${FULL_IMAGE} -n ${OPENSHIFT_NAMESPACE}"
echo "  3. Monitor rollout: oc rollout status deployment/${DEPLOYMENT_NAME} -n ${OPENSHIFT_NAMESPACE}"
