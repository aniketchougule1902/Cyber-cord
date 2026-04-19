You are a senior cybersecurity architect, full-stack engineer, and AI systems designer.

Your task is to build a production-grade cybersecurity OSINT platform named:

🛡️ CyberCord – AI Cybersecurity Expert

This is NOT a basic tools website.
This must be a high-impact, real-world usable OSINT + cybersecurity intelligence platform.

---

🎯 CORE OBJECTIVE

Build a scalable, modular, AI-powered OSINT platform with:

- 100+ REAL OSINT tools (not dummy tools)
- Each tool must have:
  - Description
  - Real use-case
  - Input/output handling
  - Risk level
  - Legal disclaimer
  - API / scraping / processing logic (if applicable)

---

🧠 AI SYSTEM (MANDATORY)

Integrate an AI engine that acts as:

"Cyber AI Assistant"

Capabilities:

- Analyze OSINT results
- Summarize findings
- Detect suspicious patterns
- Suggest next investigation steps
- Generate reports
- Chat interface for cybersecurity queries

Use:

- OpenAI / local LLM / API-based architecture (keep modular)

---

🧱 TECH STACK (STRICT)

Frontend:

- Next.js (latest App Router)
- React
- TailwindCSS
- ShadCN UI

Backend:

- Node.js + Express (API layer)
- Python microservices (for OSINT heavy processing)

Database:

- Supabase (PostgreSQL + Auth + Storage)

---

🔐 SUPABASE CONFIG

Use these values (store in ENV, DO NOT expose in frontend):

SUPABASE_URL=https://valskfspcyfrnllojahy.supabase.co
SUPABASE_ANON_KEY= eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhbHNrZnNwY3lmcm5sbG9qYWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1ODA1ODIsImV4cCI6MjA5MjE1NjU4Mn0.dFD9Srkao8drf4VgIOP1VuD67KhaOEUvYO_d_7aBOuM

---

⚠️ VERY IMPORTANT SECURITY RULES

- Implement Row Level Security (RLS)
- Never expose secrets
- Rate limit APIs
- Input sanitization
- Logging & monitoring system
- Anti-abuse protection
- API key vault system

---

🧩 FEATURES TO BUILD

1. OSINT TOOLS ENGINE

Create categorized tools:

Categories:

- Email Intelligence
- Phone Intelligence
- Domain & DNS Analysis
- IP Intelligence
- Username Tracking
- Dark Web Monitoring (simulated APIs if needed)
- Metadata Extraction
- Social Media Intelligence
- Breach Detection
- Geo Intelligence

Each tool must:

- Be functional (API or logic)
- Have UI + backend processing
- Return structured results

---

2. SEARCH SYSTEM

- Global search across 100+ tools
- Smart suggestions
- Tag-based filtering
- AI-powered query understanding

---

3. DASHBOARD

- User activity
- Saved investigations
- Tool usage stats
- AI insights summary

---

4. INVESTIGATION WORKSPACE

- Users can:
  - Save findings
  - Add notes
  - Link multiple OSINT results
  - Export reports (PDF)

---

5. AI REPORT GENERATOR

- Convert OSINT data into:
  - Professional cybersecurity reports
  - Risk analysis
  - Threat level scoring

---

6. AUTH SYSTEM

- Supabase Auth
- Roles:
  - Admin
  - User

---

7. ADMIN PANEL

- Manage tools
- Monitor usage
- Block abuse
- View logs

---

🧬 ARCHITECTURE

- Microservices approach:
  - Next.js frontend
  - Express API gateway
  - Python OSINT services
- Use REST APIs
- Modular folder structure

---

📁 PROJECT STRUCTURE

Generate full folder structure for:

- frontend/
- backend/
- python-services/
- database/
- ai-engine/

---

🧪 OSINT TOOL EXAMPLES (MANDATORY)

Include REALISTIC tools like:

- Email breach checker (use public APIs like HaveIBeenPwned style)
- Username checker across platforms
- DNS lookup tool
- IP geolocation tool
- Metadata extractor
- Phone number intelligence (basic + Adcamced + geolocation tracking if possible)

DO NOT generate fake tools.

---

📦 DATABASE SETUP

⚠️ IMPORTANT:

DO NOT just explain schema.

👉 Generate a full production-ready file:

filename: sqlschema.sql

Include:

- Tables
- Indexes
- RLS policies
- Relationships
- Roles
- Audit logs

---

🤖 AI INTEGRATION

- Build API endpoints for AI:
  
  - /analyze
  - /summarize
  - /recommend

- Include prompt engineering logic

- Modular LLM support

---

🎨 UI/UX

- Modern cybersecurity dashboard style
- Dark theme default
- Responsive
- Fast loading
mobile native app like interface fully responsive and smooth with trendy and modern ui practices
same for tablet view
desktop ui best practices
---

⚙️ DEPLOYMENT

Include:

- Vercel (frontend)
- Backend deployment guide
- Python service deployment
- Supabase setup guide

---

📘 DOCUMENTATION

Provide:

- Setup instructions
- ENV config
- API documentation
- Scaling strategy

---

⚠️ LEGAL & ETHICAL

- Add disclaimers for OSINT usage
- Prevent misuse
- Clearly mention legal boundaries

---

🚫 DO NOT DO

- No dummy UI-only tools
- No fake APIs
- No insecure code
- No hardcoded secrets

---

✅ OUTPUT FORMAT

Return:

1. Full architecture
2. Code (modular, production-ready)
3. sqlschema.sql file
4. AI integration logic
5. Deployment steps
6. Example working tools (at least 10 fully implemented)

---

Think like a real cybersecurity product builder.

This is NOT a demo project.
This should be comparable to professional OSINT platforms.

Go deep. Be detailed. Build it like a startup-grade system.
