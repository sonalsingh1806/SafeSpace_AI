import os
import re
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

import google.generativeai as genai

from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings

def parse_sections(text: str) -> dict:
    raw = dict(re.findall(r"\[(.*?)\]\s*(.*?)(?=\n\[|$)", text, re.S))
    return {
        "acknowledge": raw.get("ACKNOWLEDGE", "").strip(),
        "explore":     raw.get("EXPLORE", "").strip(),
        "reframe":     raw.get("REFRAME", "").strip(),
        "try_this":    raw.get("TRY", "").strip(),
        "question":    raw.get("QUESTION", "").strip(),
    }


def _sections_to_plaintext(sections: dict) -> str:
    parts = [v for v in sections.values() if v]
    return "\n\n".join(parts)


# ---------------- ENV ----------------
_BASE_DIR = Path(__file__).resolve().parent
_CLIENT_DIR = _BASE_DIR.parent / "client"
load_dotenv(_BASE_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Ports: backend runs on PORT, CORS allows FRONTEND_ORIGIN (frontend port).
# Default 3001 so another app can use 3000 locally; override with PORT in .env.
PORT = int(os.getenv("PORT", 3001))
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5500")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")

if not GEMINI_API_KEY:
    raise ValueError("Missing GEMINI_API_KEY in .env")

if not OPENAI_API_KEY:
    raise ValueError("Missing OPENAI_API_KEY in .env")

genai.configure(api_key=GEMINI_API_KEY)

# ---------------- FASTAPI ----------------
app = FastAPI()


def _cors_headers(request: Request) -> dict[str, str]:
    """Echo Origin so browsers accept error responses (500/502) that skip CORSMiddleware otherwise."""
    origin = request.headers.get("origin")
    if not origin:
        return {}
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
    }


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
        headers=_cors_headers(request),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=_cors_headers(request),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    import traceback

    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers=_cors_headers(request),
    )


# Local dev: allow any port on localhost/127.0.0.1 (Live Server, Vite, etc.), not only FRONTEND_ORIGIN.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://127.0.0.1:5500", "http://localhost:5500"],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def ensure_cors_on_all_responses(request: Request, call_next):
    """Echo Origin on every response so 500s and other edge paths still pass browser CORS checks."""
    response = await call_next(request)
    origin = request.headers.get("origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


class Query(BaseModel):
    userMessage: str
    conversationHistory: list[dict] = []  # NEW: [{role, content}, ...]


# ---------------- RETRIEVER ----------------
PERSIST_DIRECTORY = str(_BASE_DIR / "db" / "chroma_db")

embedding_model = OpenAIEmbeddings(model="text-embedding-3-small")

db = Chroma(
    persist_directory=PERSIST_DIRECTORY,
    embedding_function=embedding_model,
    collection_metadata={"hnsw:space": "cosine"},
)

retriever = db.as_retriever(
    search_type="mmr",
    search_kwargs={
        "k": 3,
        "fetch_k": 10,
        "filter": {"content_type": "technique"}  # prioritize technique chunks
    }
)

retriever_relaxed = db.as_retriever(
    search_type="mmr",
    search_kwargs={"k": 3, "fetch_k": 10},
)


def _parse_retry_seconds(error_message: str) -> float:
    """Parse 'Please retry in X.XXs' from Gemini API error message."""
    match = re.search(r"retry in (\d+(?:\.\d+)?)\s*s", error_message, re.I)
    if match:
        return min(float(match.group(1)) + 1, 60)
    return 25.0


def _retrieve_docs(user_query: str):
    """Retrieve chunks; errors here were uncaught and surfaced as HTTP 500."""
    try:
        docs = retriever.invoke(user_query)
        if not docs:
            docs = retriever_relaxed.invoke(user_query)
        return docs
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=(
                "Retrieval failed (embeddings or vector DB). "
                "Confirm OPENAI_API_KEY in server/.env and that db/chroma_db exists. "
                f"({type(e).__name__}: {e})"
            ),
        ) from e


def _gemini_output_text(response) -> str:
    """response.text raises ValueError when the model returns no text (e.g. safety)."""
    if response is None:
        return ""
    try:
        return (response.text or "").strip()
    except (ValueError, AttributeError):
        pass
    try:
        lines = []
        for cand in response.candidates or []:
            content = getattr(cand, "content", None)
            if not content:
                continue
            for part in getattr(content, "parts", None) or []:
                txt = getattr(part, "text", None)
                if txt:
                    lines.append(txt)
        return "\n".join(lines).strip()
    except Exception:
        return ""


# ---------------- RAG ENDPOINT ----------------
@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.post("/rag")
def rag(query: Query):
    user_query = (query.userMessage or "").strip()
    if not user_query:
        raise HTTPException(status_code=400, detail="userMessage is required")

    docs = _retrieve_docs(user_query)
    context = "\n\n".join(
        [f"Chunk {i + 1}:\n{doc.page_content}" for i, doc in enumerate(docs)]
    )
    history_text = ""
    if query.conversationHistory:
        history_text = "\n".join(
            f"{'User' if m.get('role') == 'user' else 'Therapist'}: {m.get('content', '')}"
            for m in query.conversationHistory[-6:]  # last 3 exchanges
        )
        history_text = f"\nPrevious conversation:\n{history_text}\n"

    model = genai.GenerativeModel(GEMINI_MODEL)

    prompt = f""" You are SafeSpace AI, a supportive companion trained in Cognitive Behavioral Therapy (CBT) techniques.

THERAPEUTIC FRAMEWORK
You follow a gentle, structured CBT approach across the conversation arc:
1. CONNECT — Validate emotions and build rapport (first 1-2 exchanges)
2. EXPLORE — Identify the specific thought or situation triggering distress
3. EXAMINE — Gently surface cognitive distortions (catastrophizing, all-or-nothing thinking, mind reading, etc.)
4. REFRAME — Help the user find a more balanced, evidence-based perspective
5. ACT — Suggest one small, concrete behavioral activation or coping step

CURRENT STAGE GUIDANCE
- Read the conversation history to determine which stage is appropriate.
- Do NOT rush to reframing. Spend time in CONNECT and EXPLORE first.
- Never label the user's distortion by name (don't say "that's catastrophizing"). 
  Instead, ask questions that naturally surface it: "What's the evidence for that thought?"
- If the user is in acute distress, stay in CONNECT and offer grounding techniques first.

COGNITIVE DISTORTION DETECTION (internal use only — do not mention these terms to the user)
Watch for: catastrophizing, mind reading, fortune telling, all-or-nothing thinking, 
emotional reasoning, should statements, personalization, discounting positives.

MUST-FOLLOW OUTPUT FORMAT
[ACKNOWLEDGE]
1-2 sentences validating the emotion specifically (not generically).

[EXPLORE]  
1-2 sentences. Either: identify a specific thought to examine, OR ask a Socratic question 
that moves the conversation forward therapeutically.

[REFRAME]
(Only include this section if you have enough context. Otherwise omit entirely.)
1-2 sentences offering a balanced alternative perspective, presented as a possibility not a fact.
Start with: "One way to look at this might be..."

[TRY]
One small, specific, doable action for right now. Must be concrete.

[QUESTION]
One open, Socratic question that deepens reflection (not a yes/no question).

RULES
- Warm, conversational tone. Never clinical or preachy.
- Never diagnose. Never say "you have X."
- If suicidal ideation or self-harm is mentioned, immediately provide crisis resources:
  988 Suicide & Crisis Lifeline (call/text 988) and step outside the CBT framework.
- Maximum 2 sentences per section. No markdown. No extra text.
- Context relevance: use retrieved context ONLY if it concretely matches the user's specific situation.
  If unsure, ignore the context entirely.

{history_text}
Retrieved context (use only if directly relevant):
{context}

User: {user_query}
"""

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = model.generate_content(prompt)
            raw_text = _gemini_output_text(response)
            sections = parse_sections(raw_text)
            return {
                "raw": raw_text,
                "sections": sections,
                "reply": _sections_to_plaintext(sections),
            }
        except HTTPException:
            raise
        except Exception as e:
            msg = str(e)
            is_quota = (
                "429" in msg
                or "quota" in msg.lower()
                or "RESOURCE_EXHAUSTED" in msg
                or "rate" in msg.lower()
            )
            if is_quota and attempt < max_retries - 1:
                delay = _parse_retry_seconds(msg)
                time.sleep(delay)
                continue
            if is_quota:
                raise HTTPException(
                    status_code=429,
                    detail="Gemini API rate limit reached. Please wait a moment and try again, or check your quota at https://ai.google.dev/gemini-api/docs/rate-limits",
                )
            if (
                "403" in msg
                or "401" in msg
                or "permission denied" in msg.lower()
                or "api key" in msg.lower()
                or "leaked" in msg.lower()
            ):
                raise HTTPException(
                    status_code=401,
                    detail="Gemini API rejected the request. Replace GEMINI_API_KEY in server/.env with a valid, active key.",
                )
            raise HTTPException(status_code=502, detail=f"Model error: {msg}")


if _CLIENT_DIR.exists():
    app.mount("/", StaticFiles(directory=_CLIENT_DIR, html=True), name="client")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
