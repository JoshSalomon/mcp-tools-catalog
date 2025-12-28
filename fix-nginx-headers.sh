#!/bin/bash
#
# Fix nginx TLS sidecar to forward authentication headers
#

set -e

echo "Fixing nginx sidecar configuration..."

# Get current deployment
oc get deployment -n backstage backstage -o json > /tmp/backstage-deployment.json

# Update the nginx config using jq
jq '.spec.template.spec.containers[] |= 
  if .name == "nginx-tls" then
    .args[0] = "# Write nginx config\ncat > /tmp/nginx.conf << '\''NGINXCONF'\''\nworker_processes auto;\nerror_log /dev/stderr;\npid /tmp/nginx.pid;\n\nevents {\n  worker_connections 1024;\n}\n\nhttp {\n  access_log /dev/stdout;\n  client_body_temp_path /tmp/client_body;\n  proxy_temp_path /tmp/proxy;\n  fastcgi_temp_path /tmp/fastcgi;\n  uwsgi_temp_path /tmp/uwsgi;\n  scgi_temp_path /tmp/scgi;\n  \n  server {\n    listen 7443 ssl;\n    ssl_certificate /etc/tls/tls.crt;\n    ssl_certificate_key /etc/tls/tls.key;\n    ssl_protocols TLSv1.2 TLSv1.3;\n    \n    location / {\n      proxy_pass http://127.0.0.1:7007;\n      proxy_set_header Host $host;\n      proxy_set_header X-Real-IP $remote_addr;\n      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n      proxy_set_header X-Forwarded-Proto https;\n      \n      # Forward authentication headers\n      proxy_set_header X-Forwarded-Access-Token $http_x_forwarded_access_token;\n      proxy_set_header Authorization $http_authorization;\n      \n      proxy_read_timeout 120s;\n      proxy_connect_timeout 30s;\n    }\n  }\n}\nNGINXCONF\n\n# Run nginx with custom config\nexec nginx -c /tmp/nginx.conf -g '\''daemon off;'\''\n"
  else
    .
  end' /tmp/backstage-deployment.json > /tmp/backstage-deployment-updated.json

# Apply the updated deployment
echo "Applying updated deployment..."
oc apply -f /tmp/backstage-deployment-updated.json

# Wait for rollout
echo "Waiting for rollout to complete..."
oc rollout status deployment/backstage -n backstage --timeout=5m

echo "✅ Nginx sidecar updated successfully!"
echo ""
echo "Authentication headers now being forwarded:"
echo "  - X-Forwarded-Access-Token (from OpenShift console proxy)"
echo "  - Authorization (if provided directly)"
echo ""
echo "Next steps:"
echo "  1. Wait for backstage pod to be ready (~30 seconds)"
echo "  2. Refresh your browser (Ctrl+Shift+R)"
echo "  3. Try disabling a tool again"
