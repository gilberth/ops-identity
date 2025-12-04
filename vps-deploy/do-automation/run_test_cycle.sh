#!/bin/bash

# Configuration
DO_API_TOKEN="${DO_API_TOKEN}"
REGION="nyc1"
SIZE="s-2vcpu-4gb" # Slightly larger for build performance
IMAGE="ubuntu-24-04-x64"
TAG_NAME="auto-test-deploy"
SSH_KEY_NAME="auto-test-key-$(date +%s)"
DROPLET_NAME="auto-test-droplet-$(date +%s)"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SSH_KEY_PATH="$SCRIPT_DIR/id_rsa_test"
PROJECT_ROOT="$SCRIPT_DIR/../.."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    cleanup
    exit 1
}

# Cleanup function
cleanup() {
    log "Cleaning up resources..."
    
    if [ ! -z "$DROPLET_ID" ]; then
        log "Deleting Droplet $DROPLET_ID..."
        curl -X DELETE -H "Content-Type: application/json" \
             -H "Authorization: Bearer $DO_API_TOKEN" \
             "https://api.digitalocean.com/v2/droplets/$DROPLET_ID"
    fi

    if [ ! -z "$SSH_KEY_ID" ]; then
        log "Deleting SSH Key $SSH_KEY_ID..."
        curl -X DELETE -H "Content-Type: application/json" \
             -H "Authorization: Bearer $DO_API_TOKEN" \
             "https://api.digitalocean.com/v2/account/keys/$SSH_KEY_ID"
    fi

    if [ -f "$SSH_KEY_PATH" ]; then
        rm "$SSH_KEY_PATH" "$SSH_KEY_PATH.pub"
    fi
    
    log "Cleanup complete."
}

# Check dependencies
if ! command -v jq &> /dev/null; then
    echo "jq is required but not installed. Please install it."
    exit 1
fi

if [ -z "$DO_API_TOKEN" ]; then
    echo "DO_API_TOKEN environment variable is not set."
    exit 1
fi

# Trap interrupts for cleanup
trap cleanup SIGINT SIGTERM

# 1. Generate SSH Key
log "Generating temporary SSH key..."
ssh-keygen -t rsa -b 4096 -f "$SSH_KEY_PATH" -N "" -C "auto-deploy" > /dev/null 2>&1
PUB_KEY=$(cat "$SSH_KEY_PATH.pub")

# 2. Upload SSH Key to DigitalOcean
log "Uploading SSH key to DigitalOcean..."
SSH_KEY_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DO_API_TOKEN" \
    -d "{\"name\":\"$SSH_KEY_NAME\",\"public_key\":\"$PUB_KEY\"}" \
    "https://api.digitalocean.com/v2/account/keys")

SSH_KEY_ID=$(echo $SSH_KEY_RESPONSE | jq -r '.ssh_key.id')

if [ "$SSH_KEY_ID" == "null" ]; then
    error "Failed to upload SSH key. Response: $SSH_KEY_RESPONSE"
fi

log "SSH Key ID: $SSH_KEY_ID"

# 3. Create Droplet
log "Creating Droplet ($DROPLET_NAME)..."
DROPLET_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DO_API_TOKEN" \
    -d "{\"name\":\"$DROPLET_NAME\",\"region\":\"$REGION\",\"size\":\"$SIZE\",\"image\":\"$IMAGE\",\"ssh_keys\":[$SSH_KEY_ID],\"tags\":[\"$TAG_NAME\"]}" \
    "https://api.digitalocean.com/v2/droplets")

DROPLET_ID=$(echo $DROPLET_RESPONSE | jq -r '.droplet.id')

if [ "$DROPLET_ID" == "null" ]; then
    error "Failed to create droplet. Response: $DROPLET_RESPONSE"
fi

log "Droplet ID: $DROPLET_ID created. Waiting for IP..."

# 4. Wait for IP
IP_ADDRESS=""
while [ -z "$IP_ADDRESS" ] || [ "$IP_ADDRESS" == "null" ]; do
    sleep 5
    DROPLET_INFO=$(curl -s -X GET -H "Content-Type: application/json" \
        -H "Authorization: Bearer $DO_API_TOKEN" \
        "https://api.digitalocean.com/v2/droplets/$DROPLET_ID")
    IP_ADDRESS=$(echo $DROPLET_INFO | jq -r '.droplet.networks.v4[] | select(.type=="public") | .ip_address')
done

log "Droplet IP: $IP_ADDRESS"

# 5. Wait for SSH to be ready
log "Waiting for SSH to become available..."
RETRIES=0
MAX_RETRIES=30
while ! ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i "$SSH_KEY_PATH" root@$IP_ADDRESS "echo 'SSH Ready'" > /dev/null 2>&1; do
    sleep 5
    RETRIES=$((RETRIES+1))
    if [ $RETRIES -ge $MAX_RETRIES ]; then
        error "Timed out waiting for SSH."
    fi
    echo -n "."
done
echo ""
log "SSH is ready!"

# 6. Deploy Application
log "Starting deployment..."

# Helper for SSH commands
run_remote() {
    ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@$IP_ADDRESS "$1"
}

# Helper for SCP
copy_to_remote() {
    scp -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" -r "$1" root@$IP_ADDRESS:"$2"
}

# Create directory
run_remote "mkdir -p /root/ad-security-assessment/frontend/app"

# Copy files
log "Copying configuration files..."
copy_to_remote "$PROJECT_ROOT/vps-deploy/docker-compose.yml" "/root/ad-security-assessment/"
copy_to_remote "$PROJECT_ROOT/vps-deploy/init.sql" "/root/ad-security-assessment/"
copy_to_remote "$PROJECT_ROOT/vps-deploy/backend" "/root/ad-security-assessment/"
copy_to_remote "$PROJECT_ROOT/vps-deploy/frontend/nginx.conf" "/root/ad-security-assessment/frontend/"

# Create Dockerfile for frontend on remote (as per original script)
log "Creating frontend Dockerfile..."
run_remote "cat > /root/ad-security-assessment/frontend/Dockerfile << 'EOF'
FROM node:18-alpine as build
WORKDIR /app
COPY app/package*.json ./
RUN npm install
COPY app/ .
RUN npm run build
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD [\"nginx\", \"-g\", \"daemon off;\"]
EOF"

# Prepare and copy source code
log "Packing and copying source code..."
# We use a subshell to change dir without affecting script
(cd "$PROJECT_ROOT" && tar czf - package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts tailwind.config.ts postcss.config.js components.json index.html src public .env.production 2>/dev/null) | \
    ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@$IP_ADDRESS "cd /root/ad-security-assessment/frontend/app && tar xzf -"

# OVERRIDE .env.production for this test deployment ONLY
log "Configuring frontend to use local backend..."
run_remote "echo 'VITE_VPS_ENDPOINT=/api' > /root/ad-security-assessment/frontend/app/.env.production"

# Create .env file on remote
log "Configuring environment..."
# Try to find OPENAI_API_KEY in local .env
LOCAL_ENV_FILE="$PROJECT_ROOT/vps-deploy/.env"
API_KEY=""
if [ -f "$LOCAL_ENV_FILE" ]; then
    API_KEY=$(grep OPENAI_API_KEY "$LOCAL_ENV_FILE" | cut -d '=' -f2)
fi

if [ -z "$API_KEY" ]; then
    log "${YELLOW}Warning: OPENAI_API_KEY not found in local .env. Using placeholder.${NC}"
    API_KEY="sk-placeholder-key"
fi

run_remote "echo 'OPENAI_API_KEY=$API_KEY' > /root/ad-security-assessment/.env"

# Start Docker Compose
log "Starting services (Docker Compose)..."
# We might need to install docker first if the image doesn't have it. 
# DigitalOcean's standard Ubuntu image usually doesn't have Docker pre-installed unless selected.
# I'll add a quick docker install step just in case.
run_remote "if ! command -v docker &> /dev/null; then curl -fsSL https://get.docker.com | sh; fi"

run_remote "cd /root/ad-security-assessment && docker compose up -d --build"

log "Deployment triggered. Waiting for services to stabilize (30s)..."
sleep 30

# 7. Verification
log "Verifying deployment..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$IP_ADDRESS")

if [ "$HTTP_STATUS" == "200" ]; then
    log "${GREEN}SUCCESS! Application is running at http://$IP_ADDRESS${NC}"
else
    log "${YELLOW}Application returned status $HTTP_STATUS. It might still be starting.${NC}"
fi

log "Checking backend logs..."
run_remote "cd /root/ad-security-assessment && docker compose logs --tail=20 backend"

# 8. Wait for user input before destruction
log "${YELLOW}Deployment complete. The server is running at http://$IP_ADDRESS${NC}"
log "Press ENTER to destroy the server and cleanup, or Ctrl+C to keep it running (you will have to delete it manually)."
read -r

cleanup
