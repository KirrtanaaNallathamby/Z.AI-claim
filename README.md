# Agentic Decision Intelligence Insurance Platform

A multi-stakeholder insurance system that uses AI as an autonomous Claims Adjuster. The system reasons through evidence (PDFs and images) and policy rules to decide if a claim should be approved, rejected, or flagged for fraud.

## Architecture

- **Backend**: FastAPI + Supabase + Z.AI GLM (tool-calling agent)
- **Frontend**: React + Vite + Supabase JS (file uploads)
- **Database**: Supabase (PostgreSQL + Storage)

## Setup

### Prerequisites
- Python 3.12+
- Node.js 18+

### Backend
```bash
cd backend
python -m venv venv
venv/Scripts/pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your keys:
```
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-anon-key
Z_AI_API_KEY=your-z-ai-api-key
```

Run:
```bash
venv/Scripts/uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
```

Copy `.env.example` to `.env` and fill in your keys:
```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=http://127.0.0.1:8000
```

Run:
```bash
npm run dev
```

### Supabase Setup

Create a Supabase project and run the following tables and storage:

**Tables**: `profiles`, `policies`, `claims`, `claim_history`

**Storage Bucket**: `claim-evidence` with folders `police-reports/` and `accident-images/` (set to public)

## Flow

1. Customer registers and logs in
2. Customer submits a claim (description + PDF + image)
3. AI Adjuster reads the PDF, checks policy, runs fraud detection, estimates damage cost
4. If fraud suspected → claim flagged, customer answers AI questions (interrogation)
5. AI makes final decision: approved / rejected / flagged
6. Admin dashboard shows stats, flagged claims, approved claims — with override actions
