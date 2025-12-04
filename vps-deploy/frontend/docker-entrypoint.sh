#!/bin/sh

# Generate env-config.js from environment variables
cat <<EOF > /usr/share/nginx/html/env-config.js
window.env = {
  VPS_ENDPOINT: "${VITE_VPS_ENDPOINT:-}"
};
EOF

# Execute the CMD passed to docker run (usually nginx)
exec "$@"
