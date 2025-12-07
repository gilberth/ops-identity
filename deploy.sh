#!/bin/bash

# Cargar variables del archivo .env
set -a
[ -f .env ] && . .env
set +a

# Verificar si el token existe
if [ -z "$GITHUB_REGISTRY_TOKEN" ]; then
    echo "❌ Error: GITHUB_REGISTRY_TOKEN no está definido en el archivo .env"
    echo "Por favor agrega: GITHUB_REGISTRY_TOKEN=ghp_..."
    exit 1
fi

echo "🔐 Iniciando sesión en GitHub Container Registry..."

# Hacer login en Docker usando el token
echo "$GITHUB_REGISTRY_TOKEN" | docker login ghcr.io -u gilberth --password-stdin

if [ $? -eq 0 ]; then
    echo "✅ Login exitoso."
else
    echo "❌ Error al iniciar sesión. Verifica tu token."
    exit 1
fi

echo "🚀 Desplegando servicios con Docker Compose..."

# Levantar los servicios
docker compose pull && docker compose up -d

echo "✅ Despliegue completado."
