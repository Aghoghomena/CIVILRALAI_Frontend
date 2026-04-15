# 🇮🇪 CiviralAI — Irish Government Welfare Information Assistant

> **A RAG chatbot that gives immigrants and citizens in Ireland instant, cited answers to questions about government welfare, social benefits, and public services — sourced directly from official Irish government websites.**

> ⚠️ **This UI requires the backend to be running.** Clone and set up the backend first: [CIVILRALAI backend](https://github.com/Aghoghomena/CIVILRALAI_backend.git)

---

## 💡 What It Does

CiviralAI is a conversational AI assistant built on top of content crawled from [citizens.ie](https://www.citizensinformation.ie) and related Irish government websites. A user types a question like *"Am I entitled to Domiciliary Care Allowance?"* or *"What documents do I need for a visa renewal?"* and gets back a plain-language answer with a citation pointing to the exact government source it was drawn from.

The knowledge base is built once by crawling official sources, cleaning the HTML with an LLM, chunking the text, and indexing it in both a vector store and a keyword index. At query time, hybrid search retrieves the most relevant passages, a cross-encoder reranker scores them, and Gemini generates a grounded answer — strictly from the retrieved content, with no hallucination of policy details.

No navigating confusing government portals. No reading through dense PDF documents. Just an accurate, sourced answer.

---

## 🎯 Why It Matters — The Problem It Solves

Ireland's welfare and public services landscape is genuinely complex, and accessing it is disproportionately hard for people who are new to the country:

- 🌍 Immigrants navigating visa conditions, PPS numbers, social welfare entitlements, and health service access face a maze of overlapping agencies and schemes.
- 🔍 Citizens information is spread across multiple government websites (gov.ie, citizensinformation.ie, welfare.ie) with no unified search.
- 📄 Critical eligibility rules and application deadlines are buried in long documents that require time and literacy to parse.
- ⚠️ Misinformation from informal sources (social media groups, word of mouth) leads people to apply incorrectly or miss entitlements they qualify for.
- 🏛️ For immigrants especially, the cost of a wrong answer — a missed deadline, an incorrect form — can have serious consequences on residency status or financial security.

CiviralAI ingests the authoritative sources once, indexes them, and answers any question instantly — with a citation so the answer can always be verified against the original government page.

---

## 🏗️ Architecture — Full Text Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  INGESTION  (run once / scheduled refresh)                                  │
│                                                                              │
│  URLs / PDFs                                                                 │
│      │                                                                       │
│      ▼                                                                       │
│  Tavily Web Crawler  ──►  Raw HTML / text                                   │
│      │                                                                       │
│      ▼                                                                       │
│  Gemini LLM (cleaning)  ──►  Clean prose chunks                             │
│      │                                                                       │
│      ├──►  ChromaDB (sentence-transformer embeddings)  ──►  Vector index    │
│      │                                                                       │
│      └──►  BM25Okapi  ──────────────────────────────►  Keyword index (.pkl) │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  RUNTIME  (every user query)                                                 │
│                                                                              │
│  User input (text)                                                           │
│      │                                                                       │
│      ▼                                                                       │
│  React Router frontend  ──►  POST /api/chat  ──►  FastAPI backend           │
│                                                         │                    │
│                                                         ▼                    │
│                                              ┌─── Hybrid Search ───┐        │
│                                              │  BM25 (0.5 weight)  │        │
│                                              │  ChromaDB (0.5 wt.) │        │
│                                              └─────────┬───────────┘        │
│                                                        │                    │
│                                                        ▼                    │
│                                              Score normalisation             │
│                                              (min-max, invert chroma dist)  │
│                                                        │                    │
│                                                        ▼                    │
│                                              Cross-Encoder reranker          │
│                                              (ms-marco-MiniLM-L-6-v2)       │
│                                                        │                    │
│                                                        ▼                    │
│                                              Deduplication + context build  │
│                                                        │                    │
│                                                        ▼                    │
│                                              Gemini LLM (answer + citations)│
│                                                        │                    │
│                                                        ▼                    │
│                                              Chat bubble in browser         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Role |
|---|---|---|
| 🤖 **LLM** | Google Gemini (via OpenAI-compatible API) | Cleans ingested HTML; generates final cited answers from retrieved context |
| 🔢 **Embeddings** | `sentence-transformers` (all-MiniLM default) | Encodes text chunks into dense vectors for semantic search |
| 🗄️ **Vector store** | ChromaDB (persistent, local) | Stores and queries dense embeddings; returns top-k by cosine distance |
| 🔑 **Keyword search** | BM25Okapi (`rank-bm25`) | Exact and near-exact keyword matching; saved as a pickle index |
| 🏆 **Reranker** | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Re-scores merged candidates with query-aware pairwise scoring |
| 🕷️ **Web crawler** | Tavily | Fetches and parses Irish government source URLs at ingestion time |
| ⚡ **API layer** | FastAPI + Uvicorn | Exposes `/api/chat` endpoint; handles CORS for the frontend |
| 🎨 **Frontend** | React 19 + React Router v7 + Tailwind CSS v4 | Chat UI with shadcn/ui components (Card, ScrollArea, Avatar, Input) |
| 📊 **Observability** | LangSmith (`@traceable`) | Traces each `search_query` call end-to-end for latency and debugging |
| 🐳 **Containerisation** | Docker (multi-stage Node build) | Reproducible frontend deployments |

---

## 🧠 What I Learned / Challenges

### 1. 🔀 Hybrid search score fusion is not trivial
BM25 produces raw TF-IDF-derived floats (unbounded above) while ChromaDB returns cosine distances (0–2). Naively adding them produces nonsense rankings. The fix was to apply **min-max normalisation independently** on each result set before weighting and merging. The inversion step for ChromaDB (lower distance = better) was easy to miss and caused vector results to always rank last until caught.

### 2. ⏱️ Cross-encoder reranking changes latency dramatically
Loading `ms-marco-MiniLM-L-6-v2` on the first request added ~3–4 seconds of cold-start latency. The model is now lazy-loaded once into a module-level singleton (`_reranker`) so subsequent requests are instant. The trade-off is memory: the model stays resident for the life of the process, which is fine for a single-tenant deployment but would need a pooling strategy at scale.

### 3. 🧹 Deduplication after reranking is essential
Chunking with a 200-character overlap means adjacent chunks share significant text. Without the normalise-and-deduplicate step in `clean_reranked_results`, the LLM context window was padded with near-identical paragraphs — wasting tokens and causing the model to over-cite a single source. Unicode normalisation (NFKC) was also required to catch smart quotes and other variants that broke naive string comparison.

### 4. 🔧 The OpenAI-compatible Gemini wrapper hides response shape differences
Gemini's API is accessed through the OpenAI Python SDK (`OpenAI(base_url=...)`). The response object looks identical but `message.content` returns `None` on safety-filtered responses rather than raising an exception. This caused a silent failure during testing — the chatbot returned an empty string with no log. Defensive `hasattr` checks now guard that path.

### 5. 🛣️ React Router v7 file-based routing required unlearning v6 patterns
The `routes.ts` config convention in React Router v7 replaces `<Routes>/<Route>` JSX trees entirely. The `+types/` directory of generated TypeScript interfaces was unfamiliar at first. Getting the `onSend` callback in `home.tsx` to correctly proxy to FastAPI while keeping the `ChatBot` component fully reusable took iteration — the boundary between route logic and UI component isn't obvious in this new model.

---

## 🎬 Demo

> Live demo link will be added here after deployment.

---

## 🚀 How to Run

### ✅ Prerequisites

- Node.js 20+
- Python 3.13+
- [`uv`](https://docs.astral.sh/uv/) Python package manager
- A Google Gemini API key
- A LangSmith API key (optional, for observability)

---

### 1. Clone both repositories

This UI will not work without the backend running. Clone both:

```bash
# Backend (required)
git clone https://github.com/Aghoghomena/first_rag_project.git
cd first_rag_project

# Frontend (this repo)
git clone <ui-repo-url>
```

---

### 2. Set up the backend

```bash
cd backend
cp .env.example .env   # fill in your keys
```

Required `.env` values:

```env
GEMINI_API_KEY=your_gemini_key
GEMINI_API_BASE=https://generativelanguage.googleapis.com/v1beta/openai/
GEMINI_API_MODEL=gemini-2.0-flash
LANGCHAIN_API_KEY=your_langsmith_key   # optional
LANGCHAIN_TRACING_V2=true              # optional
```

Install dependencies and ingest data (run once before first use):

```bash
uv sync
uv run python load.py   # crawls sources, builds ChromaDB + BM25 index
```

Start the API server:

```bash
uv run uvicorn api:app --reload --port 8000
```

---

### 3. Set up the frontend

```bash
cd ../ui
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

### 4. (Optional) Run the frontend with Docker 🐳

```bash
cd ui
docker build -t civiralai-ui .
docker run -p 3000:3000 civiralai-ui
```

---

### 📁 Project structure

```
civiralAI/
├── backend/
│   ├── api.py            # FastAPI app — /api/chat and /health endpoints
│   ├── query.py          # Hybrid search → rerank → LLM pipeline
│   ├── config.py         # Gemini client initialisation
│   ├── shared/
│   │   ├── BM25.py       # BM25 index class (build + search)
│   │   ├── functions.py  # Text chunking utilities
│   │   ├── state.py      # Conversation history management + LLM call
│   │   └── tools.py      # LangGraph tool definitions
│   └── bm25/             # Persisted BM25 index (generated by load.py)
└── ui/
    ├── app/
    │   ├── routes/
    │   │   ├── home.tsx       # Main chat page — wires UI to backend API
    │   │   └── chat.tsx       # Reusable ChatBot component
    │   └── components/ui/     # shadcn/ui primitives (Card, Button, Input…)
    └── Dockerfile
```
