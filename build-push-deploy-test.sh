#!/bin/bash
#
# MCP Tools Catalog - Build, Push, Deploy & Test
#
# This script combines the entire deployment pipeline:
# 1. Build the container image
# 2. Push to container registry
# 3. Deploy to OpenShift
# 4. Run quick sanity tests
#
# Usage:
#   ./build-push-deploy-test.sh [OPTIONS]
#
# Options:
#   --skip-build      Skip the build step (use existing image)
#   --skip-tests      Skip sanity tests after deployment
#   --build-only      Only build, don't push or deploy
#   --console-only    Build/push/deploy only the console plugin (default)
#   --backstage-only  Build/push/deploy only backstage
#   --verbose         Show detailed output
#   --help            Show this help message
#

set -e
set -o pipefail

# Load image configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/.image-config.sh" ]; then
    source "${SCRIPT_DIR}/.image-config.sh"
fi

# Configuration (from .image-config.sh or environment variables)
REGISTRY=${IMAGE_REGISTRY:-${REGISTRY:-"quay.io"}}
ORG=${IMAGE_ORG:-${ORG:-"your-org"}}
CONSOLE_IMAGE_NAME=${CONSOLE_IMAGE_NAME:-${IMAGE_NAME:-"mcp-tools-catalog"}}
BACKSTAGE_IMAGE_NAME=${BACKSTAGE_IMAGE_NAME:-"backstage"}
TAG=${IMAGE_TAG:-${TAG:-"latest"}}
CONSOLE_IMAGE=${CONSOLE_IMAGE:-"${REGISTRY}/${ORG}/${CONSOLE_IMAGE_NAME}:${TAG}"}
BACKSTAGE_IMAGE=${BACKSTAGE_IMAGE:-"${REGISTRY}/${ORG}/${BACKSTAGE_IMAGE_NAME}:${TAG}"}
OPENSHIFT_NAMESPACE=${OPENSHIFT_NAMESPACE:-"mcp-tools-catalog"}
DEPLOYMENT_NAME=${DEPLOYMENT_NAME:-"mcp-catalog"}
BACKSTAGE_NAMESPACE="${BACKSTAGE_NAMESPACE:-backstage}"
BACKSTAGE_DEPLOYMENT_NAME="${BACKSTAGE_DEPLOYMENT_NAME:-backstage}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Options
SKIP_BUILD=false
SKIP_TESTS=false
BUILD_ONLY=false
VERBOSE=false
CONSOLE_ONLY=false
BACKSTAGE_ONLY=false

# Detect container runtime
detect_container_runtime() {
    if command -v podman &> /dev/null; then
        CONTAINER_CMD="podman"
    elif command -v docker &> /dev/null; then
        CONTAINER_CMD="docker"
    else
        echo -e "${RED}Error: Neither podman nor docker found${NC}"
        exit 1
    fi
}

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --build-only)
                BUILD_ONLY=true
                shift
                ;;
            --console-only)
                CONSOLE_ONLY=true
                shift
                ;;
            --backstage-only)
                BACKSTAGE_ONLY=true
                shift
                ;;
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Default to console-only if neither is specified
    if [ "$CONSOLE_ONLY" = false ] && [ "$BACKSTAGE_ONLY" = false ]; then
        CONSOLE_ONLY=true
    fi
    
    # Ensure only one is selected
    if [ "$CONSOLE_ONLY" = true ] && [ "$BACKSTAGE_ONLY" = true ]; then
        echo -e "${RED}Error: Cannot specify both --console-only and --backstage-only${NC}"
        exit 1
    fi
}

show_help() {
    cat << EOF
MCP Tools Catalog - Build, Push, Deploy & Test

Usage: $0 [OPTIONS]

Options:
  --skip-build      Skip the build step (use existing image)
  --skip-tests      Skip sanity tests after deployment
  --build-only      Only build, don't push or deploy
  --console-only    Build/push/deploy only the console plugin (default)
  --backstage-only  Build/push/deploy only backstage
  --verbose, -v     Show detailed output
  --help, -h        Show this help message

Environment variables:
  REGISTRY                  Container registry (default: quay.io)
  ORG                       Organization name (default: your-org)
  CONSOLE_IMAGE_NAME         Console plugin image name (default: mcp-tools-catalog)
  BACKSTAGE_IMAGE_NAME       Backstage image name (default: backstage)
  TAG                       Image tag (default: latest)
  OPENSHIFT_NAMESPACE       Namespace for plugin (default: mcp-tools-catalog)
  DEPLOYMENT_NAME           Deployment name (default: mcp-catalog)
  BACKSTAGE_NAMESPACE       Backstage namespace (default: backstage)
  BACKSTAGE_DEPLOYMENT_NAME Backstage deployment name (default: backstage)

Configuration:
  Create .image-config.sh with your settings:
    IMAGE_REGISTRY="quay.io"
    IMAGE_ORG="your-org"
    IMAGE_NAME="mcp-tools-catalog"
    IMAGE_TAG="latest"
    OPENSHIFT_NAMESPACE="mcp-tools-catalog"
    DEPLOYMENT_NAME="mcp-catalog"

Examples:
  $0                        # Full pipeline: build, push, deploy, test (console plugin)
  $0 --console-only         # Build/push/deploy console plugin only (default)
  $0 --backstage-only       # Build/push/deploy backstage only
  $0 --skip-build           # Push, deploy, test (use existing image)
  $0 --build-only           # Only build the image
  $0 --skip-tests           # Build, push, deploy (skip tests)
  $0 --backstage-only --skip-tests  # Build/push/deploy backstage without tests

EOF
}

print_header() {
    echo ""
    echo -e "${BLUE}${BOLD}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}${BOLD}  MCP Tools Catalog - Build, Push, Deploy & Test${NC}"
    echo -e "${BLUE}${BOLD}════════════════════════════════════════════════════════════${NC}"
    echo ""
    if [ "$CONSOLE_ONLY" = true ]; then
        echo "Target: Console Plugin"
        echo "Configuration:"
        echo "  Image:      ${CONSOLE_IMAGE}"
        echo "  Namespace:  ${OPENSHIFT_NAMESPACE}"
        echo "  Deployment: ${DEPLOYMENT_NAME}"
    elif [ "$BACKSTAGE_ONLY" = true ]; then
        echo "Target: Backstage"
        echo "Configuration:"
        echo "  Image:      ${BACKSTAGE_IMAGE}"
        echo "  Namespace:  ${BACKSTAGE_NAMESPACE}"
        echo "  Deployment: ${BACKSTAGE_DEPLOYMENT_NAME}"
    fi
    echo ""
}

print_step() {
    local step=$1
    local total=$2
    local description=$3
    echo ""
    echo -e "${GREEN}${BOLD}[Step ${step}/${total}] ${description}${NC}"
    echo "────────────────────────────────────────────────────────────"
}

# Step 1: Build Console Plugin
build_console_image() {
    print_step 1 4 "Building console plugin image"
    
    echo "Building with local build strategy (recommended)..."
    echo ""
    
    # Build the plugin package (used by console plugin)
    # Note: This uses backstage-cli to build the plugin package, but does NOT build
    # the Backstage backend (backstage-app). The plugin package is just TypeScript
    # code that uses Backstage libraries.
    echo -e "${YELLOW}Building plugin package (plugins/mcp-tools-catalog)...${NC}"
    cd "${SCRIPT_DIR}/plugins/mcp-tools-catalog"
    
    if [ ! -d "node_modules" ]; then
        echo "Installing plugin dependencies..."
        yarn install
    fi
    
    if $VERBOSE; then
        yarn tsc
        yarn build
    else
        yarn tsc 2>&1 | tail -5
        yarn build 2>&1 | tail -5
    fi
    
    cd "${SCRIPT_DIR}"
    
    # Build the OpenShift Console plugin (root level webpack build)
    echo -e "${YELLOW}Building OpenShift Console plugin (webpack)...${NC}"
    
    if [ ! -d "node_modules" ]; then
        echo "Installing root dependencies..."
        yarn install
    fi
    
    if $VERBOSE; then
        yarn build
    else
        yarn build 2>&1 | tail -10
    fi
    
    # Build container image
    echo -e "${YELLOW}Building container image...${NC}"
    ${CONTAINER_CMD} build -f Dockerfile.local -t "${CONSOLE_IMAGE}" .
    
    echo ""
    echo -e "${GREEN}✓ Build complete: ${CONSOLE_IMAGE}${NC}"
}

# Step 1: Build Backstage
build_backstage_image() {
    print_step 1 4 "Building backstage image"
    
    echo "Building Backstage backend..."
    echo ""
    
    cd "${SCRIPT_DIR}/backstage-app"
    
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        yarn install --immutable
    fi
    
    echo -e "${YELLOW}Building TypeScript...${NC}"
    if $VERBOSE; then
        yarn tsc
    else
        yarn tsc 2>&1 | tail -10
    fi
    
    echo -e "${YELLOW}Building backend bundle...${NC}"
    if $VERBOSE; then
        yarn build:backend
    else
        yarn build:backend 2>&1 | tail -10
    fi
    
    echo -e "${YELLOW}Building container image...${NC}"
    # Dockerfile expects build context to be backstage-app root
    ${CONTAINER_CMD} build -f packages/backend/Dockerfile -t "${BACKSTAGE_IMAGE}" .
    
    echo ""
    echo -e "${GREEN}✓ Build complete: ${BACKSTAGE_IMAGE}${NC}"
}

# Step 1: Build (wrapper)
build_image() {
    if [ "$CONSOLE_ONLY" = true ]; then
        build_console_image
    elif [ "$BACKSTAGE_ONLY" = true ]; then
        build_backstage_image
    fi
}

# Step 2: Push Console Plugin
push_console_image() {
    print_step 2 4 "Pushing console plugin image to registry"
    
    echo "Pushing: ${CONSOLE_IMAGE}"
    echo ""
    
    ${CONTAINER_CMD} push "${CONSOLE_IMAGE}"
    
    echo ""
    echo -e "${GREEN}✓ Push complete${NC}"
}

# Step 2: Push Backstage
push_backstage_image() {
    print_step 2 4 "Pushing backstage image to registry"
    
    echo "Pushing: ${BACKSTAGE_IMAGE}"
    echo ""
    
    ${CONTAINER_CMD} push "${BACKSTAGE_IMAGE}"
    
    echo ""
    echo -e "${GREEN}✓ Push complete${NC}"
}

# Step 2: Push (wrapper)
push_image() {
    if [ "$CONSOLE_ONLY" = true ]; then
        push_console_image
    elif [ "$BACKSTAGE_ONLY" = true ]; then
        push_backstage_image
    fi
}

# Step 3: Deploy Console Plugin
deploy_console_to_openshift() {
    print_step 3 4 "Deploying console plugin to OpenShift"
    
    # Check if logged in
    if ! oc whoami &>/dev/null; then
        echo -e "${RED}Error: Not logged into OpenShift${NC}"
        echo "Please run: oc login <cluster-url>"
        exit 1
    fi
    
    echo "Logged in as: $(oc whoami)"
    echo ""
    
    # Update deployment image
    echo -e "${YELLOW}Updating deployment image...${NC}"
    oc set image deployment/${DEPLOYMENT_NAME} \
        ${DEPLOYMENT_NAME}=${CONSOLE_IMAGE} \
        -n ${OPENSHIFT_NAMESPACE}
    
    # Force reload
    echo -e "${YELLOW}Forcing image reload...${NC}"
    TIMESTAMP=$(date +%s)
    oc rollout restart deployment/${DEPLOYMENT_NAME} -n ${OPENSHIFT_NAMESPACE}
    oc patch deployment/${DEPLOYMENT_NAME} -n ${OPENSHIFT_NAMESPACE} \
        -p "{\"spec\":{\"template\":{\"metadata\":{\"annotations\":{\"kubectl.kubernetes.io/restartedAt\":\"${TIMESTAMP}\"}}}}}" \
        --type=merge
    
    # Delete pods to force recreation
    oc delete pods -l app=${DEPLOYMENT_NAME} -n ${OPENSHIFT_NAMESPACE} --ignore-not-found=true 2>/dev/null || true
    
    # Wait for rollout
    echo -e "${YELLOW}Waiting for rollout...${NC}"
    oc rollout status deployment/${DEPLOYMENT_NAME} -n ${OPENSHIFT_NAMESPACE} --timeout=120s
    
    # Verify manifest
    echo -e "${YELLOW}Verifying plugin manifest...${NC}"
    sleep 3
    POD=$(oc get pods -n ${OPENSHIFT_NAMESPACE} -l app=${DEPLOYMENT_NAME} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
    
    if [ -n "$POD" ]; then
        PLUGIN_NAME=$(oc exec -n ${OPENSHIFT_NAMESPACE} $POD -- cat /usr/share/nginx/html/plugin-manifest.json 2>/dev/null | grep -o '"name":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
        
        if [ "$PLUGIN_NAME" == "mcp-catalog" ]; then
            echo -e "${GREEN}✓ Manifest verified: name=$PLUGIN_NAME${NC}"
        else
            echo -e "${YELLOW}⚠ Manifest name: $PLUGIN_NAME (expected: mcp-catalog)${NC}"
        fi
    fi
    
    # Restart console pods
    echo -e "${YELLOW}Restarting console pods...${NC}"
    oc delete pods -n openshift-console -l app=console --ignore-not-found=true 2>/dev/null || true
    
    echo ""
    echo -e "${GREEN}✓ Deployment complete${NC}"
    echo ""
    echo -e "${YELLOW}Note: Console pods are restarting. Wait 1-2 minutes before testing.${NC}"
    
    # Wait for console pods to be ready
    echo "Waiting for console pods to be ready..."
    sleep 10
    RETRIES=12
    while [ $RETRIES -gt 0 ]; do
        CONSOLE_READY=$(oc get pods -n openshift-console -l app=console --no-headers 2>/dev/null | grep -c "Running" || echo "0")
        if [[ "$CONSOLE_READY" -gt 0 ]]; then
            echo -e "${GREEN}✓ Console pods ready${NC}"
            break
        fi
        echo "  Waiting... ($RETRIES retries left)"
        sleep 5
        ((RETRIES--))
    done
}

# Step 3: Deploy Backstage
deploy_backstage_to_openshift() {
    print_step 3 4 "Deploying backstage to OpenShift"
    
    # Check if logged in
    if ! oc whoami &>/dev/null; then
        echo -e "${RED}Error: Not logged into OpenShift${NC}"
        echo "Please run: oc login <cluster-url>"
        exit 1
    fi
    
    echo "Logged in as: $(oc whoami)"
    echo ""
    
    # Update deployment image
    echo -e "${YELLOW}Updating deployment image...${NC}"
    oc set image deployment/${BACKSTAGE_DEPLOYMENT_NAME} \
        ${BACKSTAGE_DEPLOYMENT_NAME}=${BACKSTAGE_IMAGE} \
        -n ${BACKSTAGE_NAMESPACE}
    
    # Force reload
    echo -e "${YELLOW}Forcing image reload...${NC}"
    TIMESTAMP=$(date +%s)
    oc rollout restart deployment/${BACKSTAGE_DEPLOYMENT_NAME} -n ${BACKSTAGE_NAMESPACE}
    oc patch deployment/${BACKSTAGE_DEPLOYMENT_NAME} -n ${BACKSTAGE_NAMESPACE} \
        -p "{\"spec\":{\"template\":{\"metadata\":{\"annotations\":{\"kubectl.kubernetes.io/restartedAt\":\"${TIMESTAMP}\"}}}}}" \
        --type=merge
    
    # Delete pods to force recreation
    oc delete pods -l app=${BACKSTAGE_DEPLOYMENT_NAME} -n ${BACKSTAGE_NAMESPACE} --ignore-not-found=true 2>/dev/null || true
    
    # Wait for rollout
    echo -e "${YELLOW}Waiting for rollout...${NC}"
    oc rollout status deployment/${BACKSTAGE_DEPLOYMENT_NAME} -n ${BACKSTAGE_NAMESPACE} --timeout=120s
    
    echo ""
    echo -e "${GREEN}✓ Deployment complete${NC}"
}

# Step 3: Deploy (wrapper)
deploy_to_openshift() {
    if [ "$CONSOLE_ONLY" = true ]; then
        deploy_console_to_openshift
    elif [ "$BACKSTAGE_ONLY" = true ]; then
        deploy_backstage_to_openshift
    fi
}

# Step 4: Test Console Plugin
run_console_sanity_tests() {
    print_step 4 4 "Running console plugin sanity tests"
    
    ISSUES=0
    
    # Check 1: Plugin pods
    echo -n "  1. Plugin pods... "
    PLUGIN_PODS=$(oc get pods -n $OPENSHIFT_NAMESPACE -l app=${DEPLOYMENT_NAME} --no-headers 2>/dev/null | grep -c "Running" || echo "0")
    if [[ "$PLUGIN_PODS" -gt 0 ]]; then
        echo -e "${GREEN}OK${NC} ($PLUGIN_PODS running)"
    else
        echo -e "${RED}FAILED${NC}"
        ((ISSUES++))
    fi
    
    # Check 2: Console pods
    echo -n "  2. Console pods... "
    CONSOLE_PODS=$(oc get pods -n openshift-console -l app=console --no-headers 2>/dev/null | grep -c "Running" || echo "0")
    if [[ "$CONSOLE_PODS" -gt 0 ]]; then
        echo -e "${GREEN}OK${NC} ($CONSOLE_PODS running)"
    else
        echo -e "${RED}FAILED${NC}"
        ((ISSUES++))
    fi
    
    # Check 3: Plugin registered
    echo -n "  3. Plugin registered... "
    PLUGINS=$(oc get consoles.operator.openshift.io cluster -o jsonpath='{.spec.plugins}' 2>/dev/null || echo "")
    if echo "$PLUGINS" | grep -q "mcp-catalog"; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC} - Not in console plugins"
        ((ISSUES++))
    fi
    
    # Check 4: ConsolePlugin CR
    echo -n "  4. ConsolePlugin CR... "
    if oc get consoleplugin mcp-catalog &>/dev/null; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        ((ISSUES++))
    fi
    
    # Summary
    echo ""
    if [[ "$ISSUES" -eq 0 ]]; then
        echo -e "${GREEN}${BOLD}✅ All sanity tests passed!${NC}"
        return 0
    else
        echo -e "${RED}${BOLD}❌ $ISSUES issue(s) found${NC}"
        return 1
    fi
}

# Step 4: Test Backstage
run_backstage_sanity_tests() {
    print_step 4 4 "Running backstage sanity tests"
    
    ISSUES=0
    
    # Check 1: Backstage pods
    echo -n "  1. Backstage pods... "
    BS_PODS=$(oc get pods -n $BACKSTAGE_NAMESPACE -l app=${BACKSTAGE_DEPLOYMENT_NAME} --no-headers 2>/dev/null | grep -c "Running" || echo "0")
    if [[ "$BS_PODS" -gt 0 ]]; then
        echo -e "${GREEN}OK${NC} ($BS_PODS running)"
    else
        echo -e "${RED}FAILED${NC}"
        ((ISSUES++))
    fi
    
    # Check 2: Quick API test
    echo -n "  2. Backstage API... "
    oc port-forward -n $BACKSTAGE_NAMESPACE svc/${BACKSTAGE_DEPLOYMENT_NAME} 17007:7007 &>/dev/null &
    PF_PID=$!
    sleep 2
    
    if kill -0 $PF_PID 2>/dev/null; then
        ENTITY_COUNT=$(curl -s http://localhost:17007/api/catalog/entities 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
        kill $PF_PID 2>/dev/null || true
        wait $PF_PID 2>/dev/null || true
        if [[ "$ENTITY_COUNT" -ge 0 ]]; then
            echo -e "${GREEN}OK${NC} ($ENTITY_COUNT entities)"
        else
            echo -e "${YELLOW}WARN${NC} - API reachable but could not count entities"
        fi
    else
        echo -e "${YELLOW}SKIP${NC} - Could not port-forward"
        ((ISSUES++))
    fi
    
    # Summary
    echo ""
    if [[ "$ISSUES" -eq 0 ]]; then
        echo -e "${GREEN}${BOLD}✅ All sanity tests passed!${NC}"
        return 0
    else
        echo -e "${RED}${BOLD}❌ $ISSUES issue(s) found${NC}"
        return 1
    fi
}

# Step 4: Test (wrapper)
run_sanity_tests() {
    if [ "$CONSOLE_ONLY" = true ]; then
        run_console_sanity_tests
    elif [ "$BACKSTAGE_ONLY" = true ]; then
        run_backstage_sanity_tests
    fi
}

# Main
main() {
    parse_args "$@"
    detect_container_runtime
    print_header
    
    local TOTAL_STEPS=4
    local START_TIME=$(date +%s)
    
    # Determine what to run
    if $BUILD_ONLY; then
        TOTAL_STEPS=1
        build_image
    elif $SKIP_BUILD && $SKIP_TESTS; then
        TOTAL_STEPS=2
        push_image
        deploy_to_openshift
    elif $SKIP_BUILD; then
        TOTAL_STEPS=3
        push_image
        deploy_to_openshift
        run_sanity_tests
    elif $SKIP_TESTS; then
        TOTAL_STEPS=3
        build_image
        push_image
        deploy_to_openshift
    else
        build_image
        push_image
        deploy_to_openshift
        run_sanity_tests
    fi
    
    local END_TIME=$(date +%s)
    local DURATION=$((END_TIME - START_TIME))
    
    echo ""
    echo -e "${BLUE}${BOLD}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}${BOLD}  Pipeline Complete!${NC}"
    echo -e "${BLUE}${BOLD}════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "  Duration: ${DURATION}s"
    if [ "$CONSOLE_ONLY" = true ]; then
        echo "  Image:    ${CONSOLE_IMAGE}"
        echo ""
        echo "Next steps:"
        echo "  1. Hard refresh your browser: Ctrl+Shift+R"
        echo "  2. Navigate to the MCP Catalog in OpenShift Console"
        echo "  3. For detailed tests: ./tests/sanity/run-sanity-tests.sh"
    elif [ "$BACKSTAGE_ONLY" = true ]; then
        echo "  Image:    ${BACKSTAGE_IMAGE}"
        echo ""
        echo "Next steps:"
        echo "  1. Check backstage pods: oc get pods -n ${BACKSTAGE_NAMESPACE}"
        echo "  2. Check backstage logs: oc logs -n ${BACKSTAGE_NAMESPACE} -l app=${BACKSTAGE_DEPLOYMENT_NAME}"
        echo "  3. Access backstage route: oc get route -n ${BACKSTAGE_NAMESPACE}"
    fi
    echo ""
}

main "$@"
