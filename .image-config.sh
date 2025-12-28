#!/bin/bash
# Common image configuration for MCP Catalog scripts
# Source this file in your scripts or export these variables before running scripts

# Image registry (default: quay.io)
export IMAGE_REGISTRY=${IMAGE_REGISTRY:-"quay.io"}

# Organization/user (default: jsalomon)
export IMAGE_ORG=${IMAGE_ORG:-"jsalomon"}

# Console plugin image name (default: mcp-tools-catalog)
export CONSOLE_IMAGE_NAME=${CONSOLE_IMAGE_NAME:-${IMAGE_NAME:-"mcp-tools-catalog"}}

# Backstage image name (default: backstage)
export BACKSTAGE_IMAGE_NAME=${BACKSTAGE_IMAGE_NAME:-"backstage"}

# Image tag (default: latest)
# You can override this with: export IMAGE_TAG=v1.0.0
# Or use a timestamp: export IMAGE_TAG=$(date +%Y%m%d-%H%M%S)
export IMAGE_TAG=${IMAGE_TAG:-"latest"}

# Full image references
export CONSOLE_IMAGE="${IMAGE_REGISTRY}/${IMAGE_ORG}/${CONSOLE_IMAGE_NAME}:${IMAGE_TAG}"
export BACKSTAGE_IMAGE="${IMAGE_REGISTRY}/${IMAGE_ORG}/${BACKSTAGE_IMAGE_NAME}:${IMAGE_TAG}"

# Legacy support: FULL_IMAGE defaults to console image
export FULL_IMAGE=${FULL_IMAGE:-"${CONSOLE_IMAGE}"}

# OpenShift namespace (default: mcp-tools-catalog)
export OPENSHIFT_NAMESPACE=${OPENSHIFT_NAMESPACE:-"mcp-tools-catalog"}

# Console plugin deployment name (default: mcp-catalog)
export DEPLOYMENT_NAME=${DEPLOYMENT_NAME:-"mcp-catalog"}

# Backstage namespace (default: backstage)
export BACKSTAGE_NAMESPACE=${BACKSTAGE_NAMESPACE:-"backstage"}

# Backstage deployment name (default: backstage)
export BACKSTAGE_DEPLOYMENT_NAME=${BACKSTAGE_DEPLOYMENT_NAME:-"backstage"}

# Helper function to display current configuration
show_image_config() {
    echo "Image Configuration:"
    echo "  Registry:              $IMAGE_REGISTRY"
    echo "  Organization:          $IMAGE_ORG"
    echo "  Console Image Name:    $CONSOLE_IMAGE_NAME"
    echo "  Backstage Image Name: $BACKSTAGE_IMAGE_NAME"
    echo "  Tag:                   $IMAGE_TAG"
    echo "  Console Image:         $CONSOLE_IMAGE"
    echo "  Backstage Image:       $BACKSTAGE_IMAGE"
    echo "  Console Namespace:     $OPENSHIFT_NAMESPACE"
    echo "  Console Deployment:    $DEPLOYMENT_NAME"
    echo "  Backstage Namespace:   $BACKSTAGE_NAMESPACE"
    echo "  Backstage Deployment:  $BACKSTAGE_DEPLOYMENT_NAME"
}
