#!/bin/sh

# Generate env-config.js in the public directory (served by Node)
# We use the public directory where React assets are located
echo "Generating env-config.js..."
cat <<EOF > /app/public/env-config.js
window.env = {
  VPS_ENDPOINT: "${VITE_VPS_ENDPOINT:-}"
};
EOF

# Start the Bun server
echo "Starting Bun server..."
exec bun server.js
