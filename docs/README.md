# CyberCord – AI Cybersecurity Expert

> A production-grade, AI-powered OSINT platform for cybersecurity investigations.

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Environment Variables](#environment-variables)
5. [Services](#services)
6. [OSINT Tools](#osint-tools)
7. [Deployment](#deployment)

---

## Overview

CyberCord is a modular, full-stack OSINT platform featuring:
- 16+ real OSINT tools across 7 categories
- AI-powered analysis, summarization, and recommendations
- Investigation workspace with PDF export
- Supabase-backed auth (Admin + User roles) with Row Level Security
- Rate limiting, input sanitization, audit logging, and anti-abuse protection

---

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│  Next.js Frontend   │────▶│  Express API Gateway  │
│  (Port 3000)        │     │  (Port 4000)          │
└─────────────────────┘     └───────┬──────┬────────┘
                                    │      │
              ┌─────────────────────┘      └─────────────────────┐
              ▼                                                    ▼
┌──────────────────────────┐                      ┌──────────────────────────┐
│  Python OSINT Services   │                      │  AI Engine               │
│  FastAPI (Port 8000)     │                      │  Express (Port 5001)     │
└──────────────────────────┘                      └──────────────────────────┘
              │                                                    │
              └──────────────────┬───────────────────────────────┘
                                 ▼
                    ┌──────────────────────┐
                    │  Supabase            │
                    │  PostgreSQL + Auth   │
                    └──────────────────────┘
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Docker & Docker Compose (optional)
- Supabase account

### 1. Clone & install

```bash
git clone https://github.com/your-org/Cyber-cord.git
cd Cyber-cord
```

### 2. Set up environment variables

Copy the root `.env.example` to `.env` and fill in the real values:

```bash
cp .env.example .env
```

### 3. Set up Supabase database

1. Create a new Supabase project
2. Run `database/sqlschema.sql` in the Supabase SQL editor

### 4. Run with Docker Compose

```bash
# Copy .env.example to .env and fill in all required vars (see Environment Variables section)
docker-compose up --build
```

### 5. Run manually

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && npm install && node src/index.js

# Python services
cd python-services && pip install -r requirements.txt && uvicorn main:app --reload --port 8000

# AI Engine
cd ai-engine && npm install && node src/index.js
```

---

## Environment Variables

All environment variables live in a single `.env` file at the project root (copy from `.env.example`).

### Backend (`PORT`, `NODE_ENV`, Supabase, JWT, …)

| Variable | Description | Required |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | ✅ |
| `SUPABASE_ANON_KEY` | Supabase anon/public key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin) | ✅ |
| `JWT_SECRET` | Secret for JWT signing (min 32 chars) | ✅ |
| `PYTHON_SERVICES_URL` | URL for Python microservices | ✅ |
| `AI_ENGINE_URL` | URL for AI engine | ✅ |
| `CORS_ORIGIN` | Allowed CORS origin | ✅ |

### Python Services (`HIBP_API_KEY`, `ABUSEIPDB_API_KEY`, …)

| Variable | Description | Required |
|---|---|---|
| `HIBP_API_KEY` | HaveIBeenPwned API key | Optional |
| `ABUSEIPDB_API_KEY` | AbuseIPDB API key | Optional |
| `ALLOWED_ORIGINS` | Comma-separated allowed origins | ✅ |

### AI Engine (`OPENAI_API_KEY`, `OPENAI_MODEL`, …)

| Variable | Description | Required |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API key | ✅ |
| `OPENAI_BASE_URL` | API base URL (swap for local LLM) | ✅ |
| `OPENAI_MODEL` | Model name | ✅ |
| `BACKEND_API_KEY` | Internal API key for auth | ✅ |

### Frontend (`NEXT_PUBLIC_*` variables)

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | ✅ |
| `NEXT_PUBLIC_BACKEND_URL` | Express backend URL | ✅ |

---

## Services

### Frontend (Next.js 14)
- App Router with server and client components
- Dark cybersecurity theme with neon accents
- ShadCN UI component library
- Supabase auth with session management

### Backend (Express)
- REST API gateway
- Rate limiting: 100 req/15 min (general), 10 tool runs/hour
- JWT auth via Supabase
- Input sanitization with DOMPurify
- Winston logging + Morgan HTTP logs
- Helmet security headers

### Python OSINT Services (FastAPI)
- Async OSINT processing
- SlowAPI rate limiting
- Pydantic input validation
- 16 real tools across 7 categories

### AI Engine
- OpenAI-compatible (swap `OPENAI_BASE_URL` for any local LLM)
- Endpoints: `/analyze`, `/summarize`, `/recommend`
- Cybersecurity-focused prompt engineering

---

## OSINT Tools

| # | Tool | Category | API Required |
|---|---|---|---|
| 1 | Email Breach Check | Email Intelligence | HaveIBeenPwned (optional) |
| 2 | Email Verification | Email Intelligence | None |
| 3 | Email Header Analyzer | Email Intelligence | None |
| 4 | DNS Lookup | Domain & DNS | None |
| 5 | WHOIS Lookup | Domain & DNS | None |
| 6 | SSL Certificate Analyzer | Domain & DNS | None |
| 7 | Subdomain Finder | Domain & DNS | None |
| 8 | IP Geolocation | IP Intelligence | ip-api.com (free) |
| 9 | IP Reputation | IP Intelligence | AbuseIPDB (optional) |
| 10 | Port Scanner | IP Intelligence | None |
| 11 | Username Checker | Username Tracking | None (HTTP) |
| 12 | Phone Number Lookup | Phone Intelligence | None |
| 13 | Phone Formatter | Phone Intelligence | None |
| 14 | Metadata Extractor | Metadata | None |
| 15 | GitHub User OSINT | Social Media | None (public API) |
| 16 | Password Strength | Breach Detection | None |

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment instructions.
