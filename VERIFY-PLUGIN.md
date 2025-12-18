# How to Verify the Plugin is Working

## Quick Reference

The `.svc` DNS names only work **inside the Kubernetes cluster**, not from your local machine. Use one of these methods:

## Method 1: Port Forward (Easiest for Local Testing)

```bash
# Get service details
SVC_NAME=$(oc get svc -n mcp-tools-catalog -o jsonpath='{.items[0].metadata.name}')
SVC_PORT=$(oc get svc -n mcp-tools-catalog -o jsonpath='{.items[0].spec.ports[0].port}')

# Port forward (runs in background)
oc port-forward -n mcp-tools-catalog svc/${SVC_NAME} ${SVC_PORT}:${SVC_PORT} &

# Test from your local machine
curl -k https://localhost:${SVC_PORT}/plugin-manifest.json

# When done, stop port forwarding:
# pkill -f "port-forward"
```

## Method 2: Test from Inside Plugin Pod

```bash
# Get pod and service details
POD_NAME=$(oc get pods -n mcp-tools-catalog -o jsonpath='{.items[0].metadata.name}')
SVC_NAME=$(oc get svc -n mcp-tools-catalog -o jsonpath='{.items[0].metadata.name}')
SVC_PORT=$(oc get svc -n mcp-tools-catalog -o jsonpath='{.items[0].spec.ports[0].port}')

# Test from inside the pod (uses localhost or service DNS)
oc exec -n mcp-tools-catalog $POD_NAME -- \
  curl -k -s https://localhost:${SVC_PORT}/plugin-manifest.json

# Or use service DNS (works from inside cluster)
oc exec -n mcp-tools-catalog $POD_NAME -- \
  curl -k -s https://${SVC_NAME}.mcp-tools-catalog.svc:${SVC_PORT}/plugin-manifest.json
```

## Method 3: Test from Console Pod (Most Realistic)

This simulates how the OpenShift Console actually accesses your plugin:

```bash
# Get console pod and plugin service details
CONSOLE_POD=$(oc get pods -n openshift-console -l app=console -o jsonpath='{.items[0].metadata.name}')
SVC_NAME=$(oc get svc -n mcp-tools-catalog -o jsonpath='{.items[0].metadata.name}')
SVC_PORT=$(oc get svc -n mcp-tools-catalog -o jsonpath='{.items[0].spec.ports[0].port}')

# Test from console pod (this is how console accesses the plugin)
oc exec -n openshift-console $CONSOLE_POD -- \
  curl -k -s https://${SVC_NAME}.mcp-tools-catalog.svc:${SVC_PORT}/plugin-manifest.json
```

## Expected Response

You should get JSON output like:

```json
{
  "name": "mcp-catalog",
  "version": "0.1.0",
  "displayName": "MCP Tools Catalog",
  "description": "Backstage plugin for Model Context Protocol (MCP) Tools Catalog...",
  "exposedModules": {
    "McpCatalogPage": "./components/McpCatalogPage",
    "McpServerPage": "./components/McpServerPage",
    "McpToolPage": "./components/McpToolPage",
    "McpWorkloadPage": "./components/McpWorkloadPage"
  },
  "dependencies": {
    "@console/pluginAPI": "*"
  }
}
```

## Troubleshooting

### "Could not resolve host" Error

❌ **Wrong** (from your local machine):
```bash
curl -k https://mcp-catalog.mcp-tools-catalog.svc:9443/plugin-manifest.json
# Error: Could not resolve host
```

✅ **Correct** (use port-forward or exec into pod):
```bash
# Option 1: Port forward first
oc port-forward -n mcp-tools-catalog svc/mcp-catalog 9443:9443 &
curl -k https://localhost:9443/plugin-manifest.json

# Option 2: Test from inside pod
oc exec -n mcp-tools-catalog <pod-name> -- \
  curl -k -s https://localhost:9443/plugin-manifest.json
```

### "Connection refused" Error

Check if the pod is running:
```bash
oc get pods -n mcp-tools-catalog
oc logs -n mcp-tools-catalog deployment/mcp-catalog
```

### "404 Not Found" Error

The manifest file might not be in the container. Check:
```bash
POD_NAME=$(oc get pods -n mcp-tools-catalog -o jsonpath='{.items[0].metadata.name}')
oc exec -n mcp-tools-catalog $POD_NAME -- ls -la /usr/share/nginx/html/
oc exec -n mcp-tools-catalog $POD_NAME -- cat /usr/share/nginx/html/plugin-manifest.json
```

## Summary

- ✅ **Use port-forward** to test from your local machine
- ✅ **Use `oc exec`** to test from inside pods (where `.svc` DNS works)
- ❌ **Don't use `.svc` DNS** from your local machine - it won't resolve
