#!/usr/bin/env bash

# Generate Self-Signed Certificate for MCP Tools Catalog Plugin
# This script generates a self-signed certificate and optionally creates a Kubernetes secret

set -euo pipefail

# Default values
DOMAIN="${DOMAIN:-localhost}"
DAYS_VALID="${DAYS_VALID:-365}"
KEY_SIZE="${KEY_SIZE:-2048}"
OUTPUT_DIR="${OUTPUT_DIR:-./certs}"
SECRET_NAME="${SECRET_NAME:-}"
NAMESPACE="${NAMESPACE:-mcp-tools-catalog}"
SERVICE_NAME="${SERVICE_NAME:-mcp-catalog}"
CREATE_SECRET="${CREATE_SECRET:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Generate a self-signed certificate for the MCP Tools Catalog plugin.

Options:
    -d, --domain DOMAIN         Domain name or hostname (default: localhost)
    -n, --namespace NAMESPACE   Kubernetes namespace (default: mcp-tools-catalog)
    -S, --service-name NAME      Kubernetes service name (default: mcp-catalog)
    -s, --secret-name NAME      Name for Kubernetes secret (default: auto-generated)
    -c, --create-secret         Create Kubernetes secret after generating cert
    -o, --output-dir DIR        Output directory for certificates (default: ./certs)
    -D, --days DAYS             Certificate validity in days (default: 365)
    -k, --key-size SIZE         RSA key size in bits (default: 2048)
    -h, --help                  Show this help message

Environment Variables:
    DOMAIN              Domain name for the certificate
    NAMESPACE           Kubernetes namespace
    SERVICE_NAME        Kubernetes service name
    SECRET_NAME         Kubernetes secret name
    CREATE_SECRET       Set to 'true' to create Kubernetes secret
    OUTPUT_DIR          Output directory for certificates
    DAYS_VALID          Certificate validity period in days
    KEY_SIZE            RSA key size in bits

Examples:
    # Generate certificate for localhost
    $0

    # Generate certificate for specific domain
    $0 --domain console-mcp-tools-catalog.apps.your-cluster.com

    # Generate certificate and create Kubernetes secret
    $0 --domain console-mcp-tools-catalog.apps.your-cluster.com --create-secret

    # Generate certificate with custom secret name
    $0 --domain example.com --secret-name my-custom-cert --create-secret --namespace my-namespace

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--domain)
            DOMAIN="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -S|--service-name)
            SERVICE_NAME="$2"
            shift 2
            ;;
        -s|--secret-name)
            SECRET_NAME="$2"
            shift 2
            ;;
        -c|--create-secret)
            CREATE_SECRET="true"
            shift
            ;;
        -o|--output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -D|--days)
            DAYS_VALID="$2"
            shift 2
            ;;
        -k|--key-size)
            KEY_SIZE="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown option: $1${NC}" >&2
            usage
            exit 1
            ;;
    esac
done

# Check if openssl is installed
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}Error: openssl is not installed. Please install it first.${NC}" >&2
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Set default secret name if not provided
if [[ -z "$SECRET_NAME" ]]; then
    SECRET_NAME="mcp-tools-catalog-cert"
fi

KEY_FILE="$OUTPUT_DIR/tls.key"
CERT_FILE="$OUTPUT_DIR/tls.crt"

echo -e "${GREEN}Generating self-signed certificate...${NC}"
echo "  Domain: $DOMAIN"
echo "  Validity: $DAYS_VALID days"
echo "  Key size: $KEY_SIZE bits"
echo "  Output directory: $OUTPUT_DIR"
echo ""

# Generate private key
echo -e "${YELLOW}Step 1: Generating private key...${NC}"
openssl genrsa -out "$KEY_FILE" "$KEY_SIZE"
chmod 600 "$KEY_FILE"

# Generate self-signed certificate
echo -e "${YELLOW}Step 2: Generating self-signed certificate...${NC}"

# Build Subject Alternative Names (SAN) list
# Include the domain, wildcard, localhost, and Kubernetes service DNS names
SAN_LIST="DNS:$DOMAIN,DNS:*.$DOMAIN,DNS:localhost,IP:127.0.0.1"

# Add Kubernetes service DNS names if service name and namespace are provided
if [[ -n "$SERVICE_NAME" && -n "$NAMESPACE" ]]; then
    SAN_LIST="$SAN_LIST,DNS:$SERVICE_NAME.$NAMESPACE.svc,DNS:$SERVICE_NAME.$NAMESPACE.svc.cluster.local"
    echo "  Including Kubernetes service DNS names:"
    echo "    - $SERVICE_NAME.$NAMESPACE.svc"
    echo "    - $SERVICE_NAME.$NAMESPACE.svc.cluster.local"
fi

openssl req -new -x509 \
    -key "$KEY_FILE" \
    -out "$CERT_FILE" \
    -days "$DAYS_VALID" \
    -subj "/CN=$DOMAIN/O=MCP Tools Catalog/C=US/ST=State/L=City" \
    -addext "subjectAltName=$SAN_LIST"

chmod 644 "$CERT_FILE"

echo ""
echo -e "${GREEN}✓ Certificate generated successfully!${NC}"
echo ""
echo "Files created:"
echo "  Private key: $KEY_FILE"
echo "  Certificate: $CERT_FILE"
echo ""

# Display certificate information
echo -e "${YELLOW}Certificate details:${NC}"
openssl x509 -in "$CERT_FILE" -text -noout | grep -E "(Subject:|Issuer:|Validity|DNS:|IP Address:)" | head -10
echo ""

# Create Kubernetes secret if requested
if [[ "$CREATE_SECRET" == "true" ]]; then
    echo -e "${YELLOW}Creating Kubernetes secret...${NC}"
    
    # Check if kubectl/oc is available
    if command -v oc &> /dev/null; then
        KUBECTL_CMD="oc"
    elif command -v kubectl &> /dev/null; then
        KUBECTL_CMD="kubectl"
    else
        echo -e "${RED}Error: Neither 'oc' nor 'kubectl' found. Cannot create secret.${NC}" >&2
        echo "You can create the secret manually with:"
        echo "  kubectl create secret tls $SECRET_NAME --cert=$CERT_FILE --key=$KEY_FILE -n $NAMESPACE"
        exit 1
    fi
    
    # Check if namespace exists
    if ! $KUBECTL_CMD get namespace "$NAMESPACE" &> /dev/null; then
        echo -e "${YELLOW}Namespace '$NAMESPACE' does not exist. Creating it...${NC}"
        $KUBECTL_CMD create namespace "$NAMESPACE"
    fi
    
    # Delete existing secret if it exists
    if $KUBECTL_CMD get secret "$SECRET_NAME" -n "$NAMESPACE" &> /dev/null; then
        echo -e "${YELLOW}Secret '$SECRET_NAME' already exists. Deleting it...${NC}"
        $KUBECTL_CMD delete secret "$SECRET_NAME" -n "$NAMESPACE"
    fi
    
    # Create the secret
    $KUBECTL_CMD create secret tls "$SECRET_NAME" \
        --cert="$CERT_FILE" \
        --key="$KEY_FILE" \
        -n "$NAMESPACE"
    
    echo ""
    echo -e "${GREEN}✓ Kubernetes secret '$SECRET_NAME' created in namespace '$NAMESPACE'${NC}"
    echo ""
    echo "To use this secret in your Helm chart, set in values.yaml:"
    echo "  plugin:"
    echo "    certificateSecretName: \"$SECRET_NAME\""
    echo ""
else
    echo -e "${YELLOW}To create a Kubernetes secret manually, run:${NC}"
    echo "  kubectl create secret tls $SECRET_NAME \\"
    echo "    --cert=$CERT_FILE \\"
    echo "    --key=$KEY_FILE \\"
    echo "    -n $NAMESPACE"
    echo ""
    echo "Or re-run this script with --create-secret flag:"
    echo "  $0 --domain $DOMAIN --create-secret"
    echo ""
fi

echo -e "${GREEN}Done!${NC}"
