# VPS Deployment

## ⚡ Quick Deploy

```bash
# 1. Copy and configure environment
cp .env.example .env
nano .env  # Add your OPENAI_API_KEY

# 2. Deploy everything
docker compose up -d

# 3. Done! Access http://your-vps-ip
```

## 📝 Configuration

**Only ONE file to configure**: `.env`

```dotenv
# Required
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx

# Optional (uses docker-compose.yml defaults)
# DATABASE_URL=postgres://postgres:postgrespassword@db:5432/active_scan_db
```

## 🏗️ What gets deployed

- **PostgreSQL**: Database on port 5432 (internal)
- **Backend**: Node.js API on port 3000 (internal)
- **Frontend**: Nginx serving React app on port 80 (public)

## 🔄 Architecture

```
Internet (port 80)
       ↓
    Nginx
    ├─→ Static files (React app)
    └─→ /api → Backend:3000 → PostgreSQL:5432
```

The frontend is **compiled with `/api` endpoint** (see `frontend/.env.production`), so it automatically talks to the backend through nginx proxy.

## 🛠️ Useful Commands

```bash
# View logs
docker compose logs -f

# Restart services
docker compose restart

# Stop everything
docker compose down

# Rebuild and redeploy
docker compose up -d --build

# Access database
docker compose exec db psql -U postgres -d active_scan_db
```

## 📁 Directory Structure

```
project-root/
├── .env.production       # Frontend build config (VITE_VPS_ENDPOINT=/api)
├── src/, public/         # Frontend source code
└── vps-deploy/
    ├── .env              # Backend runtime config (OPENAI_API_KEY) ← ONLY SECRET FILE
    ├── .env.example      # Template
    ├── docker-compose.yml
    ├── init.sql
    ├── backend/
    │   └── Dockerfile
    └── frontend/
        ├── Dockerfile    # Builds from project root
        └── nginx.conf    # Reverse proxy config
```

## ⚠️ Important Notes

1. **Only ONE secret file**: `vps-deploy/.env` (with OPENAI_API_KEY)
2. **`.env.production` in root**: Build-time config for frontend (not secret, just `/api` endpoint)
3. **Frontend API endpoint compiled at build**: Vite replaces `VITE_VPS_ENDPOINT` during `npm run build`
4. **Backend only needs `OPENAI_API_KEY`** - Database URL is set by docker-compose
5. **All services are internal** except nginx (port 80)
