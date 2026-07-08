# CLAUDE.md

# Bunker — AI Document Processing & RAG Pipeline

This document contains permanent project context for implementing the AI ingestion layer of Bunker.

---

# Purpose

This stage implements the document intelligence layer.

This is **NOT** the chatbot.

This is **NOT** Ask My Vault.

Its only responsibility is turning uploaded resources into searchable knowledge.

Everything AI in Bunker depends on this layer.

Future features using this pipeline:

- Ask My Vault
- AI Notes Generator
- AI Quiz Generator
- AI Flashcards
- AI Study Roadmap
- Exam Readiness
- Future AI Agents

---

# Existing Architecture

Already implemented.

DO NOT redesign.

Frontend

- Next.js 15
- React Server Components
- TypeScript
- Tailwind
- shadcn/ui
- Framer Motion

Backend

- FastAPI
- SQLAlchemy 2
- Alembic
- PostgreSQL
- pgvector
- Supabase Storage
- Supabase Auth

Architecture

Server Actions

↓

FastAPI

↓

Service Layer

↓

Repositories

↓

Database

No business logic inside endpoints.

No AI logic inside API routes.

Everything belongs inside services.

---

# Core Principle

Uploaded files become searchable knowledge.

Pipeline:

Upload

↓

Validation

↓

Metadata Extraction

↓

Text Extraction

↓

Cleaning

↓

Chunking

↓

Embeddings

↓

Vector Storage

↓

Ready

Each stage must be restartable.

If embeddings fail,

chunking must NOT run again.

Resume from the last completed stage.

---

# Processing Philosophy

The worker only orchestrates.

Workers should never contain business logic.

Correct flow:

Worker

↓

Processing Service

↓

Text Extraction Service

↓

Chunking Service

↓

Embedding Service

↓

Vector Repository

Never mix responsibilities.

---

# Text Extraction

Support

PDF

DOCX

TXT

Markdown

PowerPoint

Architecture must be extensible.

Future:

Images

OCR

Audio

Video

should plug into the same interface.

---

# Chunking Rules

Recursive Character Text Splitter

Chunk Size

450–500 tokens

Overlap

75 tokens

Never split

- Code blocks
- Tables
- Mathematical formulas

Preserve

- Page number
- Heading
- Chapter
- Resource ID
- Vault ID

Each chunk is independently searchable.

---

# Embeddings

Provider abstraction required.

Never couple to OpenAI.

Current Provider

OpenAI

Model

text-embedding-3-small

Future providers

- Gemini
- Voyage AI
- Cohere
- Local models

Changing providers should only require a new adapter.

---

# Vector Search

Every semantic search MUST filter

WHERE vault_id = ?

No exceptions.

Never allow cross-vault retrieval.

Search pipeline

User Query

↓

Embedding

↓

Vector Search

↓

Top 20

↓

Rerank

↓

Top 5

↓

Returned

---

# AI Cost Tracking

Every embedding request logs

Model

Tokens

Latency

Cost

Status

Retries

User

Vault

Resource

Store inside

ai_generations

---

# Processing Jobs

Every resource processing stage is logged.

processing_jobs

contains

- Job ID
- Resource
- Stage
- Status
- Attempts
- Worker
- Error
- Started
- Completed

Each stage can retry independently.

---

# Database Rules

resource_chunks

stores

- Content
- Embedding
- Page Number
- Heading
- Chunk Index
- Metadata
- Token Count
- Resource ID
- Vault ID

Never duplicate chunks.

Never overwrite embeddings.

---

# Security

Never expose embeddings publicly.

Never expose resource chunks without permission.

Every query must pass authorization.

Vector search MUST respect tenant isolation.

Never bypass RLS.

Never use service-role credentials from the frontend.

---

# Repository Pattern

Create repositories.

Never write SQL inside services.

Example

ChunkRepository

Methods

create_chunks()

delete_chunks()

search_chunks()

get_chunk()

bulk_insert()

---

# Service Responsibilities

ProcessingService

Pipeline orchestration

ExtractionService

Extract raw text

ChunkingService

Generate chunks

EmbeddingService

Generate embeddings

VectorSearchService

Similarity search

StorageService

Downloads/uploads

No service should know implementation details of another.

---

# Future AI Compatibility

Design for

Ask My Vault

AI Notes

Quiz Generator

Flashcards

Roadmaps

Agents

without modifying architecture.

Everything should reuse

resource_chunks

and

VectorSearchService.

---

# Frontend

Create premium UI.

Components

Processing Timeline

Animated Status

Chunk Viewer

Retry Button

Error Display

GitHub Actions inspired processing visualization.

Status Colors

Gray

Pending

Blue

Running

Green

Complete

Red

Failed

---

# Error Handling

Every stage returns

Success

Retryable Failure

Fatal Failure

Failures never crash the worker.

---

# Code Quality

Strict typing.

Dependency injection.

Repository pattern.

No duplicated logic.

Small focused services.

Maximum readability.

Production-ready.

---

# Goal

By the end of this implementation:

A user uploads a document.

↓

It becomes fully searchable.

↓

Every future AI feature can immediately use it without additional processing.

This is the permanent knowledge engine of Bunker.