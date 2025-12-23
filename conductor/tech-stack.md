# Tech Stack - OpsIdentity

## Frontend
- **Framework:** React 18.3 (Vite 5.4)
- **Language:** TypeScript 5.8
- **Styling:** Tailwind CSS, shadcn/ui, Lucide React, Framer Motion
- **State & Data Fetching:** TanStack Query (React Query) v5, React Hook Form, Zod
- **Routing:** React Router DOM v6
- **Reporting & Data:** `docx` 9.5 (Word), `jspdf` & `jspdf-autotable` (PDF), `pako` (Gzip)

## Backend
- **Language/Runtime:** Node.js 18 (using Bun for execution and scripts)
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Key Libraries:** `pg` (Postgres driver), `multer` (file uploads), `passport` (auth), `node-fetch`, `adm-zip`, `dotenv`
- **AI Integration:** OpenAI API (GPT models for security assessment)

## DevOps & Infrastructure
- **Containerization:** Docker & Docker Compose
- **Web Server:** Nginx (production frontend serving)
- **Environment:** Self-hosted (Ubuntu/Debian recommended)
