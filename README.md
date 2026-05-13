# SafeSpace AI

A CBT-grounded mental health support chatbot built on a full-stack RAG architecture. SafeSpace AI combines evidence-based therapeutic structure with modern AI engineering — retrieval-augmented generation, a structured response harness, and a calm, accessible UI.

> **Portfolio artifact.** This project demonstrates production-grade AI application development. It is not a replacement for professional care.

---

## Key Technical Features

### 1. CBT-Structured Response Harness

Every AI response is parsed into a typed, structured format and rendered as a visual card UI — not a wall of text. The backend extracts five discrete CBT sections from the model output:

| Section | Purpose |
|---|---|
| `ACKNOWLEDGE` | Validates the user's emotion specifically |
| `EXPLORE` | Identifies the triggering thought or asks a Socratic question |
| `REFRAME` *(optional)* | Offers a balanced alternative perspective |
| `TRY` | One concrete, doable action for right now |
| `QUESTION` | An open reflective question to deepen the conversation |

The `/rag` endpoint returns structured JSON so the frontend can render each section independently with distinct visual treatment. Missing optional sections are silently skipped.

```json
{
  "sections": {
    "acknowledge": "It makes sense that you're feeling overwhelmed...",
    "explore": "What's the specific thought that feels most heavy right now?",
    "reframe": "One way to look at this might be...",
    "try_this": "Take three slow breaths, then write down one thing...",
    "question": "When you imagine the worst case, what does that say about what you value?"
  },
  "reply": "...",
  "raw": "..."
}
```

### 2. RAG Pipeline (Retrieval-Augmented Generation)

The backend retrieves CBT knowledge before every generation call, grounding responses in clinical material rather than model priors alone.

```
User message
     │
     ▼
OpenAI text-embedding-3-small  ──►  Chroma vector store (cosine MMR)
                                         │
                              technique-filtered retrieval (k=3, fetch_k=10)
                                         │ fallback: relaxed retrieval
                                         ▼
                              Top-k context chunks injected into prompt
                                         │
                                         ▼
                              Google Gemini (configurable model)
                                         │
                                         ▼
                              parse_sections() → structured JSON response
```

- **MMR retrieval** (Maximal Marginal Relevance) reduces redundant chunks and improves context diversity.
- **Two-tier retrieval**: technique-filtered first, relaxed fallback if no results.
- **Knowledge base**: Two clinical CBT texts chunked and embedded at ingestion time.

### 3. CBT Prompt Engineering

The system prompt implements a five-stage therapeutic arc, preventing the model from rushing to advice:

```
CONNECT → EXPLORE → EXAMINE → REFRAME → ACT
```

The model reads conversation history to determine which stage is appropriate for the current exchange. It detects cognitive distortions internally (catastrophizing, mind-reading, all-or-nothing thinking, etc.) but never names them to the user — instead surfacing them through Socratic questions.

Crisis detection is hard-wired into the prompt: any mention of self-harm immediately bypasses the CBT framework and surfaces the 988 Suicide & Crisis Lifeline.

### 4. Resilient Gemini Integration

- **Exponential backoff** on rate-limit errors: parses the `retry in Xs` value from the API error message and waits accordingly (capped at 60 s).
- **Safe text extraction**: handles safety-blocked and malformed Gemini responses without raising uncaught exceptions.
- **Model configurability**: model name is set via `GEMINI_MODEL` env var, defaulting to `gemini-2.5-flash-lite`.

### 5. Wellness Tooling

Beyond chat, the app includes two additional therapeutic tools:

**Box Breathing Visualizer** — An animated, interactive guide through the 4-count box breathing pattern (inhale → hold → exhale → hold). A dot traces the square path in real time across four configurable cycles.

**Music Therapy Player** — A draggable, floating SoundCloud widget with calming playlists. Toggled from the dashboard without navigating away from the session.

**Voice Input** — Browser-native speech recognition with interim transcripts, base-text preservation, and graceful degradation on unsupported browsers.

---

## Architecture

```
┌─────────────────────────────────────┐
│  Browser (HTML / CSS / Vanilla JS)  │
│                                     │
│  Dashboard  ──►  Chat Interface     │
│  Mood Slider    Response Harness    │
│  Breathing      Voice Input         │
│  Music Player                       │
└──────────────┬──────────────────────┘
               │  POST /rag  (JSON)
               ▼
┌──────────────────────────────────────┐
│  FastAPI  (server/server.py)         │
│                                      │
│  /rag  ──►  _retrieve_docs()         │
│             parse_sections()         │
│             Gemini generate_content  │
│                                      │
│  /healthz  (liveness probe)          │
│  static /*  (serves client/)         │
└──────────────┬───────────────────────┘
               │
       ┌───────┴──────────┐
       ▼                  ▼
  Chroma DB          Google Gemini
  (LangChain)        (generation)
  OpenAI Embeddings
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Python 3.11, FastAPI, Uvicorn |
| Vector retrieval | LangChain, Chroma, MMR search |
| Embeddings | OpenAI `text-embedding-3-small` |
| Generation | Google Gemini (configurable model) |
| Containerization | Docker (python:3.11-slim) |
| Deployment | AWS Lambda + ECR via AWS Lambda Web Adapter |

---

## Repository Structure

```
SafeSpaceAI/
├── client/
│   ├── index.html          # single-page app shell
│   ├── chat.js             # ChatInterface class, response harness renderer
│   ├── script.js           # dashboard logic, mood meter
│   ├── music.js            # SoundCloud floating player
│   ├── config.js           # env-aware API URL (localhost ↔ deployed)
│   ├── styles.css          # dashboard styles
│   └── chat.css            # chat + harness styles
├── server/
│   ├── server.py           # FastAPI app, RAG endpoint, parse_sections()
│   ├── .env.example        # environment variable template
│   └── db/                 # Chroma vector store (gitignored)
├── dataIngestion/
│   ├── ingestion_pipeline.py   # chunk, classify, embed, persist
│   └── docs/                   # source CBT text documents
├── Dockerfile
├── deploy-aws-lambda.ps1
└── requirements.txt
```

---

## Quick Start

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure environment

Copy `server/.env.example` to `server/.env`:

```env
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash-lite
PORT=3001
FRONTEND_ORIGIN=http://localhost:5500
```

### 3. Build the vector store

```bash
cd dataIngestion
python ingestion_pipeline.py
```

Place additional `.txt` CBT documents in `dataIngestion/docs/` before running to expand the knowledge base.

### 4. Start the backend

```bash
cd server
python server.py
```

Backend runs at `http://localhost:3001` (or the `PORT` value from `.env`).

### 5. Start the frontend

```bash
cd client
python -m http.server 5500
```

Open `http://localhost:5500`.

---

## API Reference

### `POST /rag`

Retrieves CBT context, generates a structured response, and returns parsed sections.

**Request**

```json
{
  "userMessage": "I keep thinking I'm going to fail the interview",
  "conversationHistory": [
    { "role": "user",      "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response**

```json
{
  "sections": {
    "acknowledge": "That anticipatory dread before a high-stakes moment is really hard to sit with.",
    "explore": "What specifically feels most threatening about failing — what would it mean about you?",
    "reframe": "One way to look at this might be that nervousness and under-preparation are different things.",
    "try_this": "Write down three things you've prepared well for this interview.",
    "question": "If a close friend had this same fear, what would you tell them?"
  },
  "reply": "...",
  "raw": "..."
}
```

**`reply`** is a plaintext join of all sections — useful for accessibility tools or non-visual consumers. **`raw`** is the unprocessed model output.

### `GET /healthz`

Liveness probe. Returns `{"ok": true}`.

---

## AWS Lambda Deployment

The app deploys as a single Lambda container image serving both the static frontend and the `/rag` API from the same origin — no separate CDN or API gateway configuration required.

**Prerequisites:** AWS CLI configured, Docker Desktop running, vector store built.

```powershell
.\deploy-aws-lambda.ps1 -Region us-east-1
```

The script provisions: ECR repository → Docker build + push → Lambda function → public Function URL. Lambda scales to zero at idle; costs are purely request-based (OpenAI and Gemini API calls bill separately per use).

---

## Screenshots

### Landing Page
![Landing Page](screenshots/Landing%20Page.png)

### CBT Chat with Response Harness
![Chat Support](screenshots/CBT%20grounded%20AI%20chatbot.png)

### Box Breathing Visualizer
![Breathing](screenshots/Breathing%20Visualiser.png)

### Music Therapy Player
![Music Therapy](screenshots/Integrated%20Calming%20Music%20Therapy.png)

---

## Safety Notice

SafeSpace AI is a supportive conversation tool and portfolio demonstration. It is **not** a licensed medical device or a substitute for professional mental health care. In a crisis, contact emergency services or dial **988** (Suicide & Crisis Lifeline, US).

## License

MIT — see `LICENSE`.
