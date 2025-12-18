# Deployment Troubleshooting Guide

This guide helps you troubleshoot deployment issues with the MCP Tools Catalog OpenShift plugin.

## Finding Your Actual Deployment Name

The deployment name depends on how you installed the Helm chart. Use these commands to find it:

```bash
# List all deployments in the namespace
oc get deployments -n mcp-tools-catalog

# List all resources created by Helm
helm list -n mcp-tools-catalog

# Get detailed info about the Helm release
helm get manifest mcp-catalog -n mcp-tools-catalog
```

### Expected Deployment Name

Based on the DEPLOYMENT.md instructions, the deployment should be named **`mcp-catalog`** (NOT `mcp-tools-catalog`).

This is because:
- The Helm install command uses: `helm install mcp-catalog ...`
- The `mcp-catalog` is the **release name**
- The Helm chart uses the release name as the deployment name when `plugin.name` is not set

## Common Issues

### Issue 1: "deployment not found" Error

**Symptom**:
```
Error from server (NotFound): deployments.apps "mcp-tools-catalog" not found
```

**Solution**:
Replace `mcp-tools-catalog` with your actual deployment name (likely `mcp-catalog`):

```bash
# ❌ WRONG
oc set volume deployment/mcp-tools-catalog ...

# ✅ CORRECT
oc set volume deployment/mcp-catalog ...
```

**To find your deployment name**:
```bash
oc get deployments -n mcp-tools-catalog
```

### Issue 2: Plugin Not Installed Yet

**Symptom**:
```
Error from server (NotFound): deployments.apps "mcp-catalog" not found
```

**Solution**:
You need to install the plugin first using Helm:

```bash
# Install the plugin
helm install mcp-catalog charts/openshift-console-plugin \
  --set plugin.image=quay.io/your-org/mcp-tools-catalog:latest \
  --set plugin.imagePullPolicy=Always \
  --namespace mcp-tools-catalog
```

### Issue 3: Wrong Namespace

**Symptom**:
Deployment exists but command fails

**Solution**:
Ensure you're using the correct namespace:

```bash
# Check current namespace
oc project

# Switch to correct namespace
oc project mcp-tools-catalog

# Or always specify namespace explicitly
oc get deployments -n mcp-tools-catalog
```

## Step-by-Step Deployment Verification

Run these commands in order to verify your deployment:

### 1. Check Namespace Exists
```bash
oc get namespace mcp-tools-catalog
```

**If not found**, create it:
```bash
oc new-project mcp-tools-catalog
```

### 2. Check Helm Release
```bash
helm list -n mcp-tools-catalog
```

**Expected output**:
```
NAME        NAMESPACE           REVISION    UPDATED                                 STATUS      CHART                           APP VERSION
mcp-catalog mcp-tools-catalog   1           2025-10-29 10:00:00.000000000 +0000 UTC deployed    openshift-console-plugin-0.1.0  1.0
```

**If not found**, install it:
```bash
helm install mcp-catalog charts/openshift-console-plugin \
  --set plugin.image=quay.io/your-org/mcp-tools-catalog:latest \
  --set plugin.imagePullPolicy=Always \
  --namespace mcp-tools-catalog
```

### 3. Check Deployment
```bash
oc get deployment -n mcp-tools-catalog
```

**Expected output**:
```
NAME          READY   UP-TO-DATE   AVAILABLE   AGE
mcp-catalog   2/2     2            2           5m
```

**Get deployment name**:
```bash
# Save deployment name to variable
DEPLOY_NAME=$(oc get deployment -n mcp-tools-catalog -o jsonpath='{.items[0].metadata.name}')
echo "Deployment name: $DEPLOY_NAME"
```

### 4. Check Pods
```bash
oc get pods -n mcp-tools-catalog
```

**Expected output**:
```
NAME                          READY   STATUS    RESTARTS   AGE
mcp-catalog-xxxxxxxxx-xxxxx   1/1     Running   0          5m
mcp-catalog-xxxxxxxxx-xxxxx   1/1     Running   0          5m
```

### 5. Check Console Plugin Registration
```bash
oc get consoleplugin
```

**Expected output** (look for your plugin):
```
NAME          AGE
mcp-catalog   5m
```

### 6. Check Console Operator
```bash
oc get consoles.operator.openshift.io cluster -o jsonpath='{.spec.plugins}' | jq .
```

**Expected**: Should include `"mcp-catalog"` in the list

## Correct Commands for ConfigMap Mount

After finding your actual deployment name, use these commands:

```bash
# Set deployment name variable
DEPLOY_NAME="mcp-catalog"  # Adjust if different

# Create ConfigMap
oc create configmap mcp-catalog-config \
  --from-file=app-config.production.yaml=deployment/app-config.deployment.yaml \
  -n mcp-tools-catalog \
  --dry-run=client -o yaml | oc apply -f -

# Mount ConfigMap in deployment
oc set volume deployment/${DEPLOY_NAME} \
  --add \
  --type=configmap \
  --configmap-name=mcp-catalog-config \
  --mount-path=/app/config \
  -n mcp-tools-catalog

# Verify the volume was added
oc get deployment/${DEPLOY_NAME} -n mcp-tools-catalog -o jsonpath='{.spec.template.spec.volumes}' | jq .
```

## Alternative: Update Deployment Using Helm

Instead of using `oc set volume`, you can update the Helm chart directly:

### Option 1: Update values.yaml

Edit `charts/openshift-console-plugin/values.yaml` and add:

```yaml
plugin:
  name: "mcp-catalog"
  # ... existing values ...
  volumes:
    - name: app-config
      configMap:
        name: mcp-catalog-config
  volumeMounts:
    - name: app-config
      mountPath: /app/config
      readOnly: true
```

Then upgrade:
```bash
helm upgrade mcp-catalog charts/openshift-console-plugin \
  --namespace mcp-tools-catalog
```

### Option 2: Patch Deployment YAML

First, update the deployment template to include volumes:

Edit `charts/openshift-console-plugin/templates/deployment.yaml` and add to volumeMounts (around line 42):

```yaml
          volumeMounts:
            - name: {{ template "openshift-console-plugin.certificateSecret" . }}
              readOnly: true
              mountPath: /var/cert
            - name: nginx-conf
              readOnly: true
              mountPath: /etc/nginx/nginx.conf
              subPath: nginx.conf
            {{- if .Values.plugin.volumeMounts }}
            {{- toYaml .Values.plugin.volumeMounts | nindent 12 }}
            {{- end }}
```

And add to volumes (around line 51):

```yaml
      volumes:
        - name: {{ template "openshift-console-plugin.certificateSecret" . }}
          secret:
            secretName: {{ template "openshift-console-plugin.certificateSecret" . }}
            defaultMode: 420
        - name: nginx-conf
          configMap:
            name: {{ template "openshift-console-plugin.name" . }}
            defaultMode: 420
        {{- if .Values.plugin.volumes }}
        {{- toYaml .Values.plugin.volumes | nindent 8 }}
        {{- end }}
```

## Quick Reference Commands

```bash
# Find deployment name
oc get deployments -n mcp-tools-catalog -o name

# Get all resources in namespace
oc get all -n mcp-tools-catalog

# Describe deployment
oc describe deployment -n mcp-tools-catalog

# Check logs
oc logs deployment/mcp-catalog -n mcp-tools-catalog

# Restart deployment
oc rollout restart deployment/mcp-catalog -n mcp-tools-catalog

# Check rollout status
oc rollout status deployment/mcp-catalog -n mcp-tools-catalog
```

## Getting Help

If you're still having issues:

1. Check the logs:
   ```bash
   oc logs deployment/$(oc get deployment -n mcp-tools-catalog -o jsonpath='{.items[0].metadata.name}') -n mcp-tools-catalog
   ```

2. Describe the deployment:
   ```bash
   oc describe deployment -n mcp-tools-catalog
   ```

3. Check events:
   ```bash
   oc get events -n mcp-tools-catalog --sort-by='.lastTimestamp'
   ```

4. Verify Helm chart:
   ```bash
   helm get values mcp-catalog -n mcp-tools-catalog
   helm get manifest mcp-catalog -n mcp-tools-catalog
   ```
