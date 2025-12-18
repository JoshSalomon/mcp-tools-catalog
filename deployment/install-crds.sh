#!/bin/bash
# Install MCP Tools Catalog CRDs to OpenShift cluster

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRD_DIR="${SCRIPT_DIR}/crds"

echo "Installing MCP Tools Catalog CRDs..."

# Check if oc is available
if ! command -v oc &> /dev/null; then
    echo "Error: oc command not found. Please install OpenShift CLI."
    exit 1
fi

# Check if connected to cluster
if ! oc whoami &> /dev/null; then
    echo "Error: Not connected to OpenShift cluster. Please run 'oc login' first."
    exit 1
fi

echo "Connected to cluster: $(oc whoami --show-server)"

# Apply CRDs
for crd in mcpserver.crd.yaml mcptool.crd.yaml mcpworkload.crd.yaml; do
    echo "Installing ${crd}..."
    oc apply -f "${CRD_DIR}/${crd}"
done

echo ""
echo "Waiting for CRDs to be established..."
oc wait --for condition=established --timeout=60s crd/mcpservers.mcp-catalog.io || true
oc wait --for condition=established --timeout=60s crd/mcptools.mcp-catalog.io || true
oc wait --for condition=established --timeout=60s crd/mcpworkloads.mcp-catalog.io || true

echo ""
echo "Verifying CRDs are installed..."
oc get crd | grep mcp-catalog.io

echo ""
echo "✅ MCP Tools Catalog CRDs installed successfully!"
echo ""
echo "You can now create MCP entities using:"
echo "  oc apply -f deployment/github-server.yaml"
echo "  oc apply -f deployment/github-create-issue-tool.yaml"
echo "  oc apply -f deployment/project-setup-workload.yaml"
