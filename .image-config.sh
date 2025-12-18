#!/bin/bash
# Common image configuration for MCP Catalog scripts
# Source this file in your scripts or export these variables before running scripts

# Image registry (default: quay.io)
export IMAGE_REGISTRY=${IMAGE_REGISTRY:-"quay.io"}

# Organization/user (default: jsalomon)
export IMAGE_ORG=${IMAGE_ORG:-"jsalomon"}

# Image name (default: mcp-tools-catalog)
export IMAGE_NAME=${IMAGE_NAME:-"mcp-tools-catalog"}

# Image tag (default: latest)
# You can override this with: export IMAGE_TAG=v1.0.0
# Or use a timestamp: export IMAGE_TAG=$(date +%Y%m%d-%H%M%S)
export IMAGE_TAG=${IMAGE_TAG:-"latest"}

# Full image reference
export FULL_IMAGE="${IMAGE_REGISTRY}/${IMAGE_ORG}/${IMAGE_NAME}:${IMAGE_TAG}"

# OpenShift namespace (default: mcp-tools-catalog)
export OPENSHIFT_NAMESPACE=${OPENSHIFT_NAMESPACE:-"mcp-tools-catalog"}

# Deployment name (default: mcp-catalog)
export DEPLOYMENT_NAME=${DEPLOYMENT_NAME:-"mcp-catalog"}

# Helper function to display current configuration
show_image_config() {
    echo "Image Configuration:"
    echo "  Registry:    $IMAGE_REGISTRY"
    echo "  Organization: $IMAGE_ORG"
    echo "  Image Name:  $IMAGE_NAME"
    echo "  Tag:         $IMAGE_TAG"
    echo "  Full Image:  $FULL_IMAGE"
    echo "  Namespace:   $OPENSHIFT_NAMESPACE"
    echo "  Deployment:  $DEPLOYMENT_NAME"
}
