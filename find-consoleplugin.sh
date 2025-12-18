#!/bin/bash
echo "=== Checking ConsolePlugins ==="
oc get consoleplugins 2>/dev/null || echo "No ConsolePlugins found or no access"

echo ""
echo "=== Checking Helm Releases ==="
helm list -n mcp-tools-catalog 2>/dev/null || echo "No Helm releases found"

echo ""
echo "=== Checking Services ==="
oc get svc -n mcp-tools-catalog 2>/dev/null || echo "No services found"

echo ""
echo "=== Suggested ConsolePlugin Name ==="
RELEASE_NAME=$(helm list -n mcp-tools-catalog -o json 2>/dev/null | jq -r '.[0].name // "mcp-catalog"' 2>/dev/null || echo "mcp-catalog")
echo "Try: oc get consoleplugin ${RELEASE_NAME}"
