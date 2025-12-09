#!/bin/bash
set -e

IMAGE_NAME="ghcr.io/gilberth/ops-identity:latest"

echo "🔨 Building Docker Image: $IMAGE_NAME..."
docker build -t $IMAGE_NAME .

echo "✅ Build Complete."
echo "To push to GitHub Container Registry, run:"
echo "docker push $IMAGE_NAME"
