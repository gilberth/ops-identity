#!/bin/bash

# Configuration
DO_API_TOKEN="${DO_API_TOKEN}"
GITHUB_TOKEN="${GITHUB_TOKEN}" # Required for pulling images
REPO_OWNER="gilberth"
REPO_NAME="ad-security-assessment-ai"
IMAGE_BACKEND="ghcr.io/$REPO_OWNER/$REPO_NAME-backend:latest"
IMAGE_FRONTEND="ghcr.io/$REPO_OWNER/$REPO_NAME-frontend:latest"

REGION="nyc1"
SIZE="s-1vcpu-2gb" # Smaller size needed since we don't build
IMAGE="ubuntu-24-04-x64"
TAG_NAME="registry-deploy"
SSH_KEY_NAME="registry-key-$(date +%s)"
DROPLET_NAME="ad-sentinel-prod-$(date +%s)"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SSH_KEY_PATH="$SCRIPT_DIR/id_rsa_registry"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"; }
error() { echo -e "${RED}[ERROR] $1${NC}"; exit 1; }

# Checks
if [ -z "$DO_API_TOKEN" ]; then error "DO_API_TOKEN is required"; fi
if [ -z "$GITHUB_TOKEN" ]; then error "GITHUB_TOKEN (PAT) is required to pull images"; fi

# 1. Generate SSH Key
log "Generating SSH key..."
ssh-keygen -t rsa -b 4096 -f "$SSH_KEY_PATH" -N "" -C "registry-deploy" > /dev/null 2>&1
PUB_KEY=$(cat "$SSH_KEY_PATH.pub")

# 2. Upload SSH Key
log "Uploading SSH key..."
SSH_KEY_ID=$(curl -s -X POST -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DO_API_TOKEN" \
    -d "{\"name\":\"$SSH_KEY_NAME\",\"public_key\":\"$PUB_KEY\"}" \
    "https://api.digitalocean.com/v2/account/keys" | jq -r '.ssh_key.id')

# 3. Create Droplet
log "Creating Droplet ($DROPLET_NAME)..."
DROPLET_ID=$(curl -s -X POST -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DO_API_TOKEN" \
    -d "{\"name\":\"$DROPLET_NAME\",\"region\":\"$REGION\",\"size\":\"$SIZE\",\"image\":\"$IMAGE\",\"ssh_keys\":[$SSH_KEY_ID],\"tags\":[\"$TAG_NAME\"]}" \
    "https://api.digitalocean.com/v2/droplets" | jq -r '.droplet.id')

log "Droplet ID: $DROPLET_ID created. Waiting for IP..."

# 4. Wait for IP
IP_ADDRESS=""
while [ -z "$IP_ADDRESS" ] || [ "$IP_ADDRESS" == "null" ]; do
    sleep 5
    IP_ADDRESS=$(curl -s -X GET -H "Content-Type: application/json" \
        -H "Authorization: Bearer $DO_API_TOKEN" \
        "https://api.digitalocean.com/v2/droplets/$DROPLET_ID" | jq -r '.droplet.networks.v4[] | select(.type=="public") | .ip_address')
done

log "Droplet IP: $IP_ADDRESS"

# 5. Wait for SSH
log "Waiting for SSH..."
while ! ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i "$SSH_KEY_PATH" root@$IP_ADDRESS "echo 'SSH Ready'" > /dev/null 2>&1; do
    sleep 5; echo -n "."
done
echo ""

# 6. Deploy
log "Configuring server..."

# Install Docker with retry logic for apt lock
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@$IP_ADDRESS "
    for i in {1..5}; do
        if curl -fsSL https://get.docker.com | sh; then
            break
        fi
        echo 'Docker install failed (likely apt lock), retrying in 10s...'
        sleep 10
    done
"

# Login to GHCR
log "Logging in to GitHub Container Registry..."
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@$IP_ADDRESS "echo '$GITHUB_TOKEN' | docker login ghcr.io -u USERNAME --password-stdin"

# Create docker-compose.yml
# Create directory structure explicitly
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@$IP_ADDRESS "mkdir -p /root/ad-sentinel"

# Create docker-compose.yml
cat > docker-compose-registry.yml <<EOF
version: '3.8'
services:
  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
      POSTGRES_DB: active_scan_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql

  backend:
    image: $IMAGE_BACKEND
    restart: always
    environment:
      PORT: 3000
      DATABASE_URL: postgres://postgres:postgrespassword@db:5432/active_scan_db
      OPENAI_API_KEY: \${OPENAI_API_KEY}
    depends_on:
      - db

  frontend:
    image: $IMAGE_FRONTEND
    restart: always
    environment:
      VITE_VPS_ENDPOINT: "" # Empty for relative paths via Nginx proxy
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
EOF

# Copy docker-compose
scp -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" docker-compose-registry.yml root@$IP_ADDRESS:/root/ad-sentinel/docker-compose.yml

# Copy init.sql (Ensure it's copied as a file)
# Use PROJECT_ROOT to find the file correctly
scp -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" "$PROJECT_ROOT/vps-deploy/init.sql" root@$IP_ADDRESS:/root/ad-sentinel/init.sql

# Start
log "Starting services..."
# We need to pass the OPENAI_API_KEY from local env
LOCAL_KEY=$(grep OPENAI_API_KEY "$PROJECT_ROOT/vps-deploy/.env" | cut -d '=' -f2)

if [ -z "$LOCAL_KEY" ]; then
    log "${YELLOW}Warning: OPENAI_API_KEY not found in local .env${NC}"
fi

# Export key and start
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@$IP_ADDRESS "cd /root/ad-sentinel && export OPENAI_API_KEY='$LOCAL_KEY' && docker compose up -d"

log "${GREEN}Deployment Complete! Access at http://$IP_ADDRESS${NC}"
