import os
import re
import time
import importlib
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

importlib.import_module("truststore").inject_into_ssl()

import google.generativeai as genai

from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings

def parse_sections(text: str) -> dict:
    raw = dict(re.findall(r"\[(.*?)\]\s*(.*?)(?=\n\[|$)", text, re.S))

    # Normalise the SUGGEST field to a clean set: {"breathing", "music"} or empty
    suggest_raw = raw.get("SUGGEST", "").strip().lower()
    suggest = set()
    if "breathing" in suggest_raw:
        suggest.add("breathing")
    if "music" in suggest_raw:
        suggest.add("music")

    return {
        "acknowledge": raw.get("ACKNOWLEDGE", "").strip(),
        "explore":     raw.get("EXPLORE", "").strip(),
        "reframe":     raw.get("REFRAME", "").strip(),
        "try_this":    raw.get("TRY", "").strip(),
        "question":    raw.get("QUESTION", "").strip(),
        "suggest":     sorted(suggest),   # e.g. [] | ["breathing"] | ["breathing","music"]
    }


def _sections_to_plaintext(sections: dict) -> str:
    parts = [v for v in sections.values() if v]
    return "\n\n".join(parts)


# ---------------- ENV ----------------
_BASE_DIR = Path(__file__).resolve().parent
_CLIENT_DIR = _BASE_DIR.parent / "client"
_PROJECT_DIR = _BASE_DIR.parent

# Local development keeps .env at the repo root; server/.env still works for deploys.
load_dotenv(_PROJECT_DIR / ".env")
load_dotenv(_BASE_DIR / ".env", override=True)

# Avoid runtime SSL failures when tiktoken tries to download OpenAI's tokenizer file.
os.environ.setdefault("TIKTOKEN_CACHE_DIR", str(_PROJECT_DIR / ".tiktoken-cache"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Ports: backend runs on PORT, CORS allows FRONTEND_ORIGIN (frontend port).
# Default 3001 so another app can use 3000 locally; override with PORT in .env.
PORT = int(os.getenv("PORT", 3001))
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5500")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
# Fallback model used automatically when the primary hits a 429 rate limit.
# Set to "" in .env to disable fallback behaviour.
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "")

if not GEMINI_API_KEY:
    raise ValueError("Missing GEMINI_API_KEY in .env")

if not OPENAI_API_KEY:
    raise ValueError("Missing OPENAI_API_KEY in .env")

# REST avoids gRPC certificate-store issues on Windows/Anaconda environments.
genai.configure(api_key=GEMINI_API_KEY, transport="rest")

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
                "Confirm OPENAI_API_KEY in .env and that server/db/chroma_db exists. "
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


# ---------------- SAFETY GUARDRAILS ----------------

_CRISIS_RE = re.compile(
    r"\b("
    r"suicid\w*"
    r"|kill\s+(my|him|her|them)\s*self"
    r"|end\s+(my|this)\s+life"
    r"|take\s+my\s+(own\s+)?life"
    r"|end\s+it\s+all"
    r"|(don'?t|do\s+not)\s+want\s+to\s+(live|be\s+alive|exist)"
    r"|want\s+to\s+die"
    r"|wish\s+I\s+(was|were)\s+dead"
    r"|better\s+off\s+dead"
    r"|no\s+reason\s+to\s+(live|be\s+here)"
    r"|self[\s\-]?harm"
    r"|cut(ting)?\s+(my)?self"
    r"|hurt(ing)?\s+(my)?self"
    r")\b",
    re.I,
)

_SUPPORT_RE = re.compile(
    r"\b("
    r"hopeless|helpless|worthless|useless"
    r"|(can'?t|cannot)\s+(go\s+on|do\s+this\s+anymore|keep\s+going)"
    r"|give\s+up|giving\s+up|no\s+point"
    r"|nobody\s+cares|no\s+one\s+cares"
    r"|completely\s+alone|all\s+alone|so\s+alone"
    r"|being\s+(abused|hurt|hit)|domestic\s+violence"
    r")\b",
    re.I,
)

_CRISIS_SECTIONS: dict[str, str] = {
    "acknowledge": (
        "What you're sharing matters deeply, and I'm really glad you said something. "
        "You don't have to face this alone."
    ),
    "explore": (
        "Right now, your safety is the only thing that matters. "
        "A trained crisis counselor can help in ways I can't — please reach out to them."
    ),
    "reframe": "",
    "try_this": (
        "Call or text 988 (Suicide & Crisis Lifeline) — free, available 24/7, completely confidential. "
        "If you're in immediate danger, please call 911."
    ),
    "question": "",
}

_SUPPORT_PROMPT_NOTE = (
    "\nSAFETY NOTE: The user's message contains signals of significant distress "
    "(hopelessness, isolation, or possible harm). Stay in the CONNECT stage. "
    "Prioritise warmth and validation. Do not rush to reframing. "
    "Gently mention that professional support is available.\n"
)


def _safety_level(text: str) -> str:
    """Return 'crisis', 'support', or 'safe' based on message content."""
    if _CRISIS_RE.search(text):
        return "crisis"
    if _SUPPORT_RE.search(text):
        return "support"
    return "safe"


# ---------------- RAG ENDPOINT ----------------
@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.post("/rag")
def rag(query: Query):
    user_query = (query.userMessage or "").strip()
    if not user_query:
        raise HTTPException(status_code=400, detail="userMessage is required")

    safety = _safety_level(user_query)

    # Crisis path: skip RAG and Gemini entirely — respond with a fixed, human-authored message.
    if safety == "crisis":
        return {
            "raw": "",
            "sections": _CRISIS_SECTIONS,
            "reply": _sections_to_plaintext(_CRISIS_SECTIONS),
            "safety_level": "crisis",
        }

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

    # Support path: inject a prompt note to keep the model in CONNECT stage.
    safety_prompt_note = _SUPPORT_PROMPT_NOTE if safety == "support" else ""

    prompt = f"""You are SafeSpace AI — a warm, perceptive companion trained in CBT who speaks like a caring,
present human being, not a template. Your responses should feel like a thoughtful message from someone
who genuinely listened, not a form that was filled out.

THERAPEUTIC FRAMEWORK (internal guide — never name these stages to the user)
1. CONNECT  — Validate and build rapport. Stay here longer than feels necessary.
2. EXPLORE  — Gently surface the specific thought or situation driving the feeling.
3. EXAMINE  — Help the user question unhelpful thinking patterns through curiosity, not labels.
4. REFRAME  — Offer a more balanced perspective only when the user is ready.
5. ACT      — Suggest one small, concrete step when it would genuinely help.

Read the conversation history to judge which stage fits. When in doubt, stay in CONNECT.

VOICE AND AUTHENTICITY
- Sound like a warm, thoughtful friend who happens to know CBT — not a chatbot running a script.
- Vary how you open each response. Don't always start with "It sounds like..." or "That makes sense."
  Try: leading with a feeling word, a gentle observation, a brief reflection, or even a soft pause phrase.
- Let sections flow into each other naturally with transitions. Avoid abrupt topic jumps.
- Match the energy of the message: a panicked message needs grounding first;
  a quiet sad message needs stillness; a frustrated message needs acknowledgment before anything else.
- Sometimes the most powerful response is just presence and one question — don't fill space for the sake of it.

COGNITIVE DISTORTION DETECTION (internal — never name these to the user)
Watch for: catastrophizing, mind reading, fortune telling, all-or-nothing thinking,
emotional reasoning, should statements, personalization, discounting positives.
Surface them through curious questions, not labels.

OUTPUT FORMAT
Use these tags so the app can parse your response. Include only what genuinely fits the moment.
All sections except [ACKNOWLEDGE] are optional — omit any that would feel forced or premature.

[ACKNOWLEDGE]
Required. 1-3 sentences. Validate the specific emotion authentically.
Avoid generic openers. Be specific to what they actually said.

[EXPLORE]
Optional. 1-2 sentences. Either gently name what seems to be driving this,
or ask one Socratic question that opens up the conversation. Not both.
Skip if you haven't built enough rapport yet or if the user needs more space first.

[REFRAME]
Optional. Only include when you have enough context AND the user seems ready.
1-2 sentences offering a balanced perspective as a possibility, not a fact.
Don't start with "One way to look at this might be" every time — vary the phrasing.

[TRY]
Optional. One specific, doable action for right now. Make it small and concrete.
Skip if no action fits naturally, or if the user needs to feel heard more than guided.

[QUESTION]
Optional. One open question that deepens reflection.
Skip if you already asked a question in [EXPLORE], or if ending in silence feels more right.

[SUGGEST]
Optional. Only if a built-in tool would genuinely help this moment.
Output exactly one of: breathing | music | breathing,music
- breathing: anxiety, panic, overwhelm, needs grounding
- music: stress relief, winding down, difficulty sleeping
- Omit entirely if the user is in crisis, just wants to talk, or a tool would feel jarring.

RULES
- No markdown, no bullet points, no headers in your response text.
- Never diagnose. Never say "you have X" or name a distortion.
- If crisis signals appear, step outside this framework entirely and prioritise safety resources.
- Use retrieved context ONLY if it directly and concretely fits. When in doubt, ignore it.

{safety_prompt_note}{history_text}
Retrieved context (use only if directly relevant):
{context}

User: {user_query}
"""

    def _call_model(model_name: str):
        return genai.GenerativeModel(model_name).generate_content(prompt)

    def _is_quota_error(msg: str) -> bool:
        return (
            "429" in msg
            or "quota" in msg.lower()
            or "RESOURCE_EXHAUSTED" in msg
            or "rate" in msg.lower()
        )

    # Try primary model with one retry on transient errors,
    # then fall back to GEMINI_FALLBACK_MODEL on 429.
    models_to_try = [GEMINI_MODEL]
    if GEMINI_FALLBACK_MODEL and GEMINI_FALLBACK_MODEL != GEMINI_MODEL:
        models_to_try.append(GEMINI_FALLBACK_MODEL)

    last_exc: Exception | None = None
    for model_name in models_to_try:
        for attempt in range(2):  # 1 retry per model for transient errors
            try:
                response = _call_model(model_name)
                raw_text = _gemini_output_text(response)
                sections = parse_sections(raw_text)
                return {
                    "raw": raw_text,
                    "sections": sections,
                    "reply": _sections_to_plaintext(sections),
                    "safety_level": safety,
                    **({"_model": model_name} if model_name != GEMINI_MODEL else {}),
                }
            except HTTPException:
                raise
            except Exception as e:
                last_exc = e
                msg = str(e)
                if _is_quota_error(msg):
                    # 429 on primary → skip straight to fallback, no sleep
                    break
                if attempt == 0:
                    # Non-quota transient error: one short wait then retry same model
                    time.sleep(2)
                    continue
                break  # second attempt also failed, move on

    # All models exhausted — surface the right error
    msg = str(last_exc) if last_exc else ""
    if _is_quota_error(msg):
        raise HTTPException(
            status_code=429,
            detail="The AI service is busy right now. Please try again in a moment.",
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
            detail="Gemini API rejected the request. Replace GEMINI_API_KEY in .env with a valid, active key.",
        )
    raise HTTPException(status_code=502, detail=f"Model error: {msg}")


if _CLIENT_DIR.exists():
    app.mount("/", StaticFiles(directory=_CLIENT_DIR, html=True), name="client")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
