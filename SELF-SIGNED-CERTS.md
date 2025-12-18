# Self-Signed Certificate Support

## Overview

All documentation and scripts have been updated to support OpenShift clusters with self-signed certificates. The `-k` (or `--insecure`) flag is used in all `curl` commands that connect to HTTPS endpoints.

## What Changed

### Documentation Files Updated

1. **DEPLOYMENT.md**
   - Added note about self-signed certificates in Prerequisites section
   - Updated all `curl` commands with HTTPS URLs to include `-k` flag
   - Added comments explaining the `-k` flag usage

2. **install_helm.sh**
   - Updated curl command to download Helm installer with `-k` flag

### Files Already Using `-k` Flag

These files already had the `-k` flag and didn't need changes:
- `test-plugin-service.sh` - All curl commands use `-k`
- `diagnose-plugin.sh` - All curl commands use `-k`
- `PLUGIN-NOT-APPEARING.md` - All curl commands use `-k`
- `PLUGIN-ENABLED-NOT-APPEARING.md` - All curl commands use `-k`

### Files Not Requiring Changes

These files use HTTP (not HTTPS) or don't use curl:
- `plugins/mcp-tools-catalog/README.md` - Uses `http://localhost` (no SSL needed)
- Other documentation files without HTTPS curl commands

## Usage

### For Clusters with Self-Signed Certificates

All curl commands in the documentation now include the `-k` flag by default:

```bash
# Example from DEPLOYMENT.md
curl -k https://console-mcp-tools-catalog.apps.your-cluster.com/api/catalog/mcp/health
```

### For Clusters with Proper Certificates

If your cluster has properly signed certificates, you can remove the `-k` flag:

```bash
# Remove -k flag for production clusters with proper certificates
curl https://console-mcp-tools-catalog.apps.your-cluster.com/api/catalog/mcp/health
```

## Security Note

⚠️ **Important**: The `-k` flag bypasses SSL certificate verification, which means:
- ✅ Safe for internal/development clusters with self-signed certificates
- ❌ Should be avoided in production environments with proper certificates
- ⚠️ Makes connections vulnerable to man-in-the-middle attacks

For production environments, it's recommended to:
1. Use properly signed certificates
2. Remove the `-k` flag from curl commands
3. Or configure curl to trust your CA certificate using `--cacert` option

## Example: Using Custom CA Certificate

If you have your cluster's CA certificate, you can use it instead of `-k`:

```bash
# Download cluster CA certificate
oc get configmap kube-root-ca.crt -n openshift-config -o jsonpath='{.data.ca\.crt}' > cluster-ca.crt

# Use --cacert instead of -k
curl --cacert cluster-ca.crt \
  https://console-mcp-tools-catalog.apps.your-cluster.com/api/catalog/mcp/health
```

## Troubleshooting

### Still Getting SSL Errors

If you're still getting SSL certificate errors:

1. **Check if you're using the correct flag**:
   ```bash
   curl -k https://your-url  # Should work with self-signed certs
   ```

2. **Verify the URL is correct**:
   ```bash
   # Test with verbose output
   curl -k -v https://your-url
   ```

3. **Check if certificate is actually self-signed**:
   ```bash
   # This will show certificate details
   openssl s_client -connect your-host:443 -showcerts
   ```

### curl: (60) SSL certificate problem

This error means curl is trying to verify the certificate. Ensure you're using the `-k` flag:

```bash
# ❌ Wrong - will fail with self-signed certs
curl https://your-url

# ✅ Correct - bypasses certificate verification
curl -k https://your-url
```

## Generating Self-Signed Certificates for the Plugin

The MCP Tools Catalog plugin requires TLS certificates to serve HTTPS traffic. You can generate a self-signed certificate using the provided script.

### Quick Start

```bash
# Generate certificate for localhost (default)
./generate-self-signed-cert.sh

# Generate certificate for your domain
./generate-self-signed-cert.sh --domain console-mcp-tools-catalog.apps.your-cluster.com

# Generate certificate and create Kubernetes secret automatically
./generate-self-signed-cert.sh \
  --domain console-mcp-tools-catalog.apps.your-cluster.com \
  --create-secret \
  --namespace mcp-tools-catalog
```

### Using the Certificate Script

The `generate-self-signed-cert.sh` script provides several options:

```bash
# Show help
./generate-self-signed-cert.sh --help

# Basic usage - generates certs in ./certs directory
./generate-self-signed-cert.sh --domain example.com

# Custom output directory
./generate-self-signed-cert.sh --domain example.com --output-dir /path/to/certs

# Custom validity period (default: 365 days)
./generate-self-signed-cert.sh --domain example.com --days 730

# Custom key size (default: 2048 bits)
./generate-self-signed-cert.sh --domain example.com --key-size 4096

# Create Kubernetes secret automatically
./generate-self-signed-cert.sh \
  --domain example.com \
  --create-secret \
  --secret-name my-custom-cert \
  --namespace my-namespace
```

### Manual Certificate Generation

If you prefer to generate certificates manually:

```bash
# Create directory for certificates
mkdir -p certs

# Generate private key
openssl genrsa -out certs/tls.key 2048

# Generate self-signed certificate
openssl req -new -x509 \
  -key certs/tls.key \
  -out certs/tls.crt \
  -days 365 \
  -subj "/CN=console-mcp-tools-catalog.apps.your-cluster.com/O=MCP Tools Catalog/C=US" \
  -addext "subjectAltName=DNS:console-mcp-tools-catalog.apps.your-cluster.com,DNS:*.*.apps.your-cluster.com,DNS:localhost,IP:127.0.0.1"

# Create Kubernetes secret
kubectl create secret tls mcp-tools-catalog-cert \
  --cert=certs/tls.crt \
  --key=certs/tls.key \
  -n mcp-tools-catalog
```

### Using the Certificate in Helm Deployment

After generating the certificate and creating the Kubernetes secret, configure your Helm values:

```yaml
plugin:
  certificateSecretName: "mcp-tools-catalog-cert"  # Name of the secret you created
```

Or let OpenShift generate the certificate automatically by leaving `certificateSecretName` empty and ensuring the service has the annotation:

```yaml
service.alpha.openshift.io/serving-cert-secret-name: mcp-tools-catalog-cert
```

### Certificate Requirements

- **Format**: The certificate must be in PEM format
- **Files**: 
  - `tls.crt` - The certificate file
  - `tls.key` - The private key file
- **Secret Type**: Kubernetes secret must be of type `tls`
- **Subject Alternative Names**: Include all domains/IPs that will access the service

### Verifying the Certificate

```bash
# View certificate details
openssl x509 -in certs/tls.crt -text -noout

# Test certificate with openssl
openssl s_client -connect your-domain:9443 -showcerts

# Verify certificate matches private key
openssl x509 -noout -modulus -in certs/tls.crt | openssl md5
openssl rsa -noout -modulus -in certs/tls.key | openssl md5
# Both outputs should match
```

## Summary

All curl commands in the project documentation now support self-signed certificates by default. The `-k` flag is included in all HTTPS curl commands, making it easy to work with development and internal OpenShift clusters.

For the plugin service itself, you can generate self-signed certificates using the `generate-self-signed-cert.sh` script, which simplifies the process of creating certificates and Kubernetes secrets.
