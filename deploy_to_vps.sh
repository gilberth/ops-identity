#!/bin/bash

# Configuration
VPS_USER="root"
VPS_IP="157.230.138.178"
REMOTE_DIR="/root/active-scan-insight"

echo "🚀 Starting deployment to $VPS_IP..."

# 1. Create remote directory
echo "📂 Creating remote directory..."
ssh $VPS_USER@$VPS_IP "mkdir -p $REMOTE_DIR/backend"

# 2. Copy files
echo "Vk📦 Copying files..."
scp vps-deploy/docker-compose.yml $VPS_USER@$VPS_IP:$REMOTE_DIR/
scp vps-deploy/init.sql $VPS_USER@$VPS_IP:$REMOTE_DIR/
scp vps-deploy/backend/Dockerfile $VPS_USER@$VPS_IP:$REMOTE_DIR/backend/
scp vps-deploy/backend/package.json $VPS_USER@$VPS_IP:$REMOTE_DIR/backend/
scp vps-deploy/backend/server.js $VPS_USER@$VPS_IP:$REMOTE_DIR/backend/

# 3. Start services
echo "🔥 Starting services on VPS..."
ssh $VPS_USER@$VPS_IP "cd $REMOTE_DIR && docker-compose down && docker-compose up -d --build"

echo "✅ Deployment complete!"
echo "   Backend API: http://$VPS_IP:3000/api/process-assessment"
echo "   Health Check: http://$VPS_IP:3000/health"
