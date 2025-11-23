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
vps-deploy/
├── .env.example          # Template (copy to .env)
├── docker-compose.yml    # Services definition
├── init.sql              # Database schema
├── backend/
│   ├── Dockerfile
│   └── (copied from ../vps-deploy/backend)
└── frontend/
    ├── Dockerfile
    ├── nginx.conf        # Reverse proxy config
    ├── .env.production   # Frontend build-time config (VITE_VPS_ENDPOINT=/api)
    └── (copied from root ../src, ../public, etc)
```

## ⚠️ Important Notes

1. **NO `.env` in root directory** - Everything is configured here in `vps-deploy/.env`
2. **Frontend has NO runtime config** - API endpoint is compiled at build time
3. **Backend only needs `OPENAI_API_KEY`** - Database URL is set by docker-compose
4. **All services are internal** except nginx (port 80)
