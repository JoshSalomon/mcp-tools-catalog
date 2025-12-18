# Backstage Console Proxy

This service runs inside the cluster and terminates requests from the OpenShift
Console proxy. It injects a Backstage `backend.auth.externalAccess` static token
and forwards the call to the Backstage backend. This lets us keep using Red Hat
Developer Hub (which currently lacks the Kubernetes auth provider) while still
enforcing authentication at the proxy boundary.

## Environment

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | Bind port | `8080` |
| `TARGET_BASE_URL` | Backstage base URL (inside the cluster) | `http://backstage-mcp-catalog-test.rhdh-operator.svc.cluster.local` |
| `AUTH_TOKEN` | Static Backstage externalAccess token (optional) | _unset_ |
| `AUTH_TOKEN_FILE` | File path that holds the token (overridden if `AUTH_TOKEN` is set) | `/var/run/secrets/backstage/token` |
| `ALLOWED_PATH_PREFIXES` | Comma-separated prefixes allowed through the proxy | `/api/catalog,/healthz` |
| `TLS_CERT_FILE` | Optional: path to TLS certificate (enables HTTPS when paired with key) | _unset_ |
| `TLS_KEY_FILE` | Optional: path to TLS private key | _unset_ |

## Build

```
podman build -t quay.io/<user>/backstage-console-proxy:latest proxy
podman push quay.io/<user>/backstage-console-proxy:latest
```

## Deploy (example)

```bash
TOKEN=$(openssl rand -hex 32)
oc -n rhdh-operator create secret generic backstage-proxy-shared --from-literal=token=${TOKEN}

# Update ConfigMap so Backstage trusts the token
cat <<EOF > /tmp/backstage-auth-config.yaml
backend:
  auth:
    keys:
      - secret: pl4s3Ch4ng3M3
    externalAccess:
      - type: static
        options:
          token: ${TOKEN}
          subject: console-proxy
        accessRestrictions:
          - plugin: catalog
EOF
oc -n rhdh-operator create configmap backstage-auth-config \
  --from-file=app-config.yaml=/tmp/backstage-auth-config.yaml \
  --dry-run=client -o yaml | oc apply -f -
oc -n rhdh-operator rollout restart deployment/backstage-mcp-catalog-test

# Deploy proxy
cat <<'EOF' | oc apply -n rhdh-operator -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backstage-console-proxy
spec:
  selector:
    matchLabels:
      app: backstage-console-proxy
  replicas: 1
  template:
    metadata:
      labels:
        app: backstage-console-proxy
    spec:
      containers:
        - name: proxy
          image: quay.io/<user>/backstage-console-proxy:latest
          env:
            - name: AUTH_TOKEN_FILE
              value: /var/run/secrets/backstage/token
            - name: TARGET_BASE_URL
              value: http://backstage-mcp-catalog-test.rhdh-operator.svc.cluster.local
            - name: ALLOWED_PATH_PREFIXES
              value: /api/catalog,/healthz
            - name: TLS_CERT_FILE
              value: /var/run/secrets/tls/tls.crt
            - name: TLS_KEY_FILE
              value: /var/run/secrets/tls/tls.key
          ports:
            - containerPort: 8080
          volumeMounts:
            - name: token
              mountPath: /var/run/secrets/backstage
              readOnly: true
            - name: tls
              mountPath: /var/run/secrets/tls
              readOnly: true
      volumes:
        - name: token
          secret:
            secretName: backstage-proxy-shared
        - name: tls
          secret:
            secretName: backstage-console-proxy-tls
---
apiVersion: v1
kind: Service
metadata:
  name: backstage-console-proxy
  annotations:
    service.alpha.openshift.io/serving-cert-secret-name: backstage-console-proxy-tls
spec:
  selector:
    app: backstage-console-proxy
  ports:
    - port: 8080
      targetPort: 8080
      protocol: TCP
EOF
```

Finally, patch the `ConsolePlugin` to point at the proxy:

```bash
oc patch consoleplugin mcp-catalog --type=merge -p '{
  "spec": {
    "proxy": [
      {
        "alias": "backstage",
        "authorization": "None",
        "endpoint": {
          "type": "Service",
          "service": {
            "name": "backstage-console-proxy",
            "namespace": "rhdh-operator",
            "port": 8080
          }
        }
      }
    ]
  }
}'
```
