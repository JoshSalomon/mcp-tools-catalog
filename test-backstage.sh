#!/bin/bash
CLUSTER_DOMAIN="josh-ocp.192-168-122-253.sslip.io"
BACKSTAGE_URL="https://backstage.apps.${CLUSTER_DOMAIN}"
TOKEN=$(oc create token backstage -n backstage)

curl -k -H "Authorization: Bearer ${TOKEN}" \
     "${BACKSTAGE_URL}/api/catalog/entities?filter=metadata.labels.mcp-catalog.io/type=server"
