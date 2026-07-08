# Bunker — Monorepo

AI-powered collaborative study OS.

## Project Structure

```
synapse/                     ← Repo root
├── src/                     ← Next.js 15 App Router (frontend)
│   ├── app/                 ← Routes & pages
│   │   ├── auth/callback/   ← Supabase OAuth callback
│   │   └── page.tsx         ← Landing page
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts    ← Browser Supabase client
│   │   │   └── server.ts    ← Server Supabase client
│   │   └── api-client.ts    ← FastAPI fetch wrapper
│   ├── types/
│   │   ├── models.ts        ← Shared TypeScript types
│   │   └── database.ts      ← Supabase generated types
│   └── middleware.ts        ← Auth guard + session refresh
├── backend/                 ← FastAPI (backend)
│   ├── app/
│   │   ├── main.py          ← Entry point
│   │   ├── core/            ← Config, logging, exceptions
│   │   ├── api/             ← Routes + dependencies
│   │   ├── models/          ← SQLAlchemy ORM models
│   │   ├── schemas/         ← Pydantic schemas
│   │   ├── services/        ← Business logic
│   │   └── db/              ← Session, base, migrations
│   ├── alembic/             ← Database migrations
│   └── requirements.txt
├── scripts/
│   └── init-db.sql          ← Docker DB init
└── docker-compose.yml
```

## Quick Start

### 1. Frontend

```bash
# Install dependencies (already done by create-next-app)
npm install

# Copy env
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# Run dev server
npm run dev
```

### 2. Backend

```bash
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy env
cp .env.example .env
# Fill in all values

# Run migrations (requires running Postgres)
alembic upgrade head

# Start dev server
uvicorn app.main:app --reload
```

### 3. Local Database (Docker)

```bash
# Start Postgres (pgvector) + Redis
docker-compose up db redis -d

# Or start everything
docker-compose up -d
```

### 4. Generate Supabase Types

```bash
# After connecting Supabase CLI to your project:
npx supabase gen types typescript --local > src/types/database.ts
```

## Environment Variables

See `.env.example` (frontend) and `backend/.env.example` (backend).

**Critical:** `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` must **only** exist in the backend `.env`. They must never be in frontend env files.
