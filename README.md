# 🛡️ Bunker

Bunker is an **AI-powered collaborative study Operating System** designed to transform course materials, syllabi, and lecture notes into a fully searchable, interactive knowledge graph. It enables students to study together in shared workspaces (Squads), create vaults of resources, generate AI study plans, take adaptive quizzes, and practice coding with real-time feedback.

---

## 🚀 Key Features

### 📁 Smart Vaults & Document Ingestion
*   **Multiformat Parsing:** Instantly uploads and processes **PDF**, **DOCX**, **PPTX**, **TXT**, and **Markdown** documents.
*   **RAG Pipeline:** Clean, chunk, and embed documents using state-of-the-art semantic search models stored locally in **PostgreSQL (`pgvector`)**.
*   **Step-by-Step Processing Timeline:** A premium, GitHub-Actions-inspired ingestion visualizer showing real-time status of document validation, chunking, and vector storage.

### 💬 Context-Aware Ask AI (RAG)
*   **Workspace Search:** Chat with an assistant that queries knowledge across all your active vaults.
*   **Academic Guardrails:** Programmed to scope answers to learning, homework help, and exam prep while filtering out unrelated queries.
*   **Deep Navigation Links:** AI answers include clickable reference cards (e.g., `📝 OS Lecture notes`) that navigate the user directly to the relevant document.

### 💻 Code Practice & Playground
*   **Language Auto-Detection:** Seamlessly parses source code files (C, Python, JS, C++) uploaded to the vaults.
*   **Interactive Monaco Editor:** A workspace featuring Monaco Editor, auto-generated tasks scoped to the course syllabus, and instant validation tests.

### 👥 Squads (Collaborative Spaces)
*   **Real-time Collaboration:** Study in public or private Squads with peer-to-peer resource sharing, activity feeds, and squad management.

---

## 🛠️ Technology Stack

### Frontend
*   **Framework:** Next.js 15 (App Router, Server Actions)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS, Framer Motion (micro-animations), shadcn/ui
*   **Editor:** Monaco Editor (`@monaco-editor/react`)

### Backend
*   **Framework:** FastAPI (Python 3.12)
*   **ORM:** SQLAlchemy 2.0 & Alembic (migrations)
*   **Databases:** PostgreSQL (with `pgvector` extension) & Redis (caching and queues)
*   **Authentication & Storage:** Supabase Auth & Supabase Storage

---

## 📁 Repository Structure

```
synapse-new/                    ← Monorepo Root
├── src/                        ← Next.js Frontend
│   ├── app/                    ← Next.js App Router (Routes & Pages)
│   ├── components/             ← Shared UI & Feature Components
│   │   ├── auth/               ← Onboarding & Login Forms
│   │   ├── resources/          ← Document upload, list, & status badges
│   │   └── ui/                 ← Design System / shadcn primitive components
│   ├── lib/                    ← Supabase clients & fetch wrappers
│   └── types/                  ← Shared TypeScript & Database Schemas
├── backend/                    ← FastAPI Backend
│   ├── app/
│   │   ├── api/                ← API routes & endpoints (v1)
│   │   ├── core/               ← App Configuration & Security
│   │   ├── db/                 ← Database session, model registrations, & schema base
│   │   ├── models/             ← SQLAlchemy Database Models
│   │   ├── schemas/            ← Pydantic validation schemas
│   │   └── services/           ← Core business logic & AI orchestration
│   ├── alembic/                ← Alembic migrations history
│   └── requirements.txt        ← Python dependencies
├── scripts/                    ← Docker database initialization scripts
└── docker-compose.yml          ← Orchestrates PostgreSQL & Redis
```

---

## ⚡ Architecture Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Student
    participant FE as Next.js Frontend
    participant BE as FastAPI Backend
    participant SUP as Supabase (Auth/Storage)
    participant DB as PostgreSQL + pgvector
    
    User->>FE: Upload Study Guide (PDF)
    FE->>SUP: Upload raw file to Storage Bucket
    SUP-->>FE: Return Storage Path URL
    FE->>BE: Create Resource (via API)
    BE->>DB: Insert resource as "pending"
    Note over BE: Asynchronous Ingestion Job Triggered
    BE->>BE: 1. Validate & extract metadata (e.g. page counts)
    BE->>BE: 2. Parse text & recursive chunking (450-token blocks)
    BE->>BE: 3. Generate vector embeddings
    BE->>DB: 4. Store text chunks with vectors in PostgreSQL
    BE-->>FE: Push Real-Time Progress status
    User->>FE: Chat: "Summarize CPU Scheduling from my guide"
    FE->>BE: Ask AI Question
    BE->>DB: Similarity vector search (restricted to Vault ID)
    DB-->>BE: Top relevant context chunks
    BE->>BE: Assemble Prompt & run LLM (Gemini)
    BE-->>FE: Structured response + Markdown answer + Nav links
    FE-->>User: Display answer with clickable source references
```

---

## ⚙️ Setup Guide

### Prerequisites
Make sure you have the following installed:
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/)
*   [Bun](https://bun.sh/) (or Node.js 18+)
*   [Python 3.12](https://www.python.org/downloads/)

---

### Step 1: Run Database and Services (Docker)
Start the PostgreSQL (with pgvector) database and Redis:
```bash
docker-compose up -d db redis
```

---

### Step 2: Backend Setup
1.  Navigate to the `backend/` directory:
    ```bash
    cd backend
    ```
2.  Create and activate your Python virtual environment:
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate  # Windows: .venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Copy environment variables file:
    ```bash
    cp .env.example .env
    ```
    *Open `.env` and fill in your Gemini API key, database credentials, and Supabase credentials.*
5.  Run database migrations:
    ```bash
    alembic upgrade head
    ```
6.  Start the dev server:
    ```bash
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ```

---

### Step 3: Frontend Setup
1.  Go to the repository root:
    ```bash
    cd ..
    ```
2.  Install dependencies:
    ```bash
    bun install  # or npm install
    ```
3.  Configure environment variables:
    ```bash
    cp .env.example .env.local
    ```
    *Add your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` variables.*
4.  Start Next.js development server:
    ```bash
    bun dev      # or npm run dev
    ```

Open your browser to `http://localhost:3000` to start exploring Bunker.

---

## 📋 Environment Configuration

### Frontend (`.env.local`)
```ini
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend (`.env`)
```ini
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/synapse
REDIS_URL=redis://localhost:6379/0
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret
```

> [!WARNING]
> Keep `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` strictly on the backend `.env`. Never expose them to client-side codebases.
