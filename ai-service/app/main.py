from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Any, Dict
import os
import aiohttp
import logging
import asyncio

from .utils.preprocess import normalize_text
from .middleware.authMiddleware import InternalAPIKeyMiddleware

logger = logging.getLogger(__name__)

app = FastAPI(title="AI Service for Multilingual Sentiment Analysis")

# Register authentication middleware
app.add_middleware(InternalAPIKeyMiddleware)

# ---------- Mode selection ----------
AI_MODE = os.environ.get("AI_MODE", "remote").lower()

# ---------- Remote URLs (only used in remote mode) ----------
LANGID_URL = os.environ.get("LANGID_SPACE_URL", "https://abyayel-fasttext-langid.hf.space/detect")
SENTIMENT_URL = os.environ.get("SENTIMENT_SPACE_URL", "https://abyayel-sentiment-models.hf.space/sentiment")
TOPIC_URL = os.environ.get("TOPIC_SPACE_URL", "https://abyayel-topic-model.hf.space/suggest-topics")
KEYWORD_URL = os.environ.get("KEYWORD_SPACE_URL", "https://abyayel-keyword-extractor.hf.space/extract")

# ---------- API Key for remote Spaces ----------
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "")
HEADERS = {"X-Internal-API-Key": INTERNAL_API_KEY} if INTERNAL_API_KEY else {}

# ---------- Remote helper functions with retries ----------
async def detect_language_remote(text: str, retries: int = 2):
    async with aiohttp.ClientSession() as session:
        for attempt in range(retries + 1):
            try:
                async with session.post(LANGID_URL, json={"text": text}, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status != 200:
                        error_text = await resp.text()
                        logger.error(f"LangID space error: status {resp.status}, body: {error_text}")
                        return {"language": "en", "raw_label": None, "confidence": 0.0}
                    data = await resp.json()
                    lang_map = {"amh": "am", "tir": "ti", "eng": "en", "orm": "om", "gaz": "om", "gax": "om", "hae": "om"}
                    raw = data.get("language", "eng")
                    lang = lang_map.get(raw, "en")
                    return {"language": lang, "raw_label": data.get("raw_label", raw), "confidence": data.get("confidence", 0.0)}
            except asyncio.TimeoutError:
                logger.warning(f"LangID timeout (attempt {attempt+1}/{retries+1})")
                if attempt == retries:
                    return {"language": "en", "raw_label": None, "confidence": 0.0}
                await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"LangID exception: {e}")
                if attempt == retries:
                    return {"language": "en", "raw_label": None, "confidence": 0.0}
                await asyncio.sleep(1)

async def analyze_sentiment_remote(text: str, language: str, retries: int = 2):
    async with aiohttp.ClientSession() as session:
        for attempt in range(retries + 1):
            try:
                async with session.post(SENTIMENT_URL, json={"text": text, "language": language}, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status != 200:
                        error_text = await resp.text()
                        logger.error(f"Sentiment space error: status {resp.status}, body: {error_text}")
                        return {"sentiment": "neutral", "confidence": 0.3, "model": "error_fallback"}
                    return await resp.json()
            except asyncio.TimeoutError:
                logger.warning(f"Sentiment timeout (attempt {attempt+1}/{retries+1})")
                if attempt == retries:
                    return {"sentiment": "neutral", "confidence": 0.3, "model": "error_fallback"}
                await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"Sentiment exception: {e}")
                if attempt == retries:
                    return {"sentiment": "neutral", "confidence": 0.3, "model": "error_fallback"}
                await asyncio.sleep(1)

async def extract_keywords_remote(text: str, language: str, top_n: int = 5, retries: int = 2):
    async with aiohttp.ClientSession() as session:
        for attempt in range(retries + 1):
            try:
                async with session.post(KEYWORD_URL, json={"text": text, "language": language, "top_n": top_n}, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status != 200:
                        error_text = await resp.text()
                        logger.error(f"Keyword space error: status {resp.status}, body: {error_text}")
                        return []
                    data = await resp.json()
                    return data.get("keywords", [])
            except asyncio.TimeoutError:
                logger.warning(f"Keyword timeout (attempt {attempt+1}/{retries+1})")
                if attempt == retries:
                    return []
                await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"Keyword exception: {e}")
                if attempt == retries:
                    return []
                await asyncio.sleep(1)

async def suggest_topics_remote(text: str, retries: int = 2):
    async with aiohttp.ClientSession() as session:
        for attempt in range(retries + 1):
            try:
                async with session.post(TOPIC_URL, json={"text": text}, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=60)) as resp:
                    if resp.status != 200:
                        error_text = await resp.text()
                        logger.error(f"Topic space error: status {resp.status}, body: {error_text}")
                        return {"topics": [{"topic": "General", "confidence": 1.0}]}
                    return await resp.json()
            except asyncio.TimeoutError:
                logger.warning(f"Topic timeout (attempt {attempt+1}/{retries+1})")
                if attempt == retries:
                    return {"topics": [{"topic": "General", "confidence": 1.0}]}
                await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"Topic exception: {e}")
                if attempt == retries:
                    return {"topics": [{"topic": "General", "confidence": 1.0}]}
                await asyncio.sleep(1)

# ---------- Local model lazy loading ----------
def load_local_language_detector():
    from .utils.language_detector import detect_language_full
    return detect_language_full

def load_local_sentiment():
    from .models.sentiment import ModelManager
    return ModelManager

def load_local_keywords():
    from .models.keywords import KeywordManager
    return KeywordManager

def load_local_topic():
    from .models.topic import get_topic_model
    return get_topic_model

# ---------- Unified functions (choose mode) ----------
async def detect_language(text: str):
    if AI_MODE == "local":
        func = load_local_language_detector()
        return await asyncio.to_thread(func, text)
    else:
        return await detect_language_remote(text)

async def analyze_sentiment(text: str, language: str):
    if AI_MODE == "local":
        mgr = load_local_sentiment()
        model = mgr.get_model_for_language(language)
        sentiment, confidence = await asyncio.to_thread(model.predict, text, language)
        return {"sentiment": sentiment, "confidence": confidence, "model": model.name}
    else:
        return await analyze_sentiment_remote(text, language)

async def extract_keywords(text: str, language: str, top_n: int = 5):
    if AI_MODE == "local":
        mgr = load_local_keywords()
        keywords = await asyncio.to_thread(mgr.extract, text, language, top_n)
        return keywords
    else:
        return await extract_keywords_remote(text, language, top_n)

async def get_topics(text: str):
    if AI_MODE == "local":
        get_model = load_local_topic()
        model = get_model()
        suggestions = await asyncio.to_thread(model.suggest, text, None)
        return {"topics": suggestions[:3]}
    else:
        return await suggest_topics_remote(text)

# ---------- Request/Response Models ----------
class AnalyzeRequest(BaseModel):
    text: str
    language: Optional[str] = None

class AnalyzeResponse(BaseModel):
    sentiment: str
    confidence: float
    keywords: List[str]
    language: str
    sentiment_model: str
    keyword_model: str

class SuggestTopicsRequest(BaseModel):
    text: str
    candidate_topics: Optional[List[str]] = None

class SuggestTopicsResponse(BaseModel):
    topics: List[Dict[str, Any]]

class BenchmarkRequest(BaseModel):
    text: str
    language: Optional[str] = None

class BenchmarkResponse(BaseModel):
    text: str
    detected_language: str
    detection_raw_label: Optional[str] = None
    detection_confidence: Optional[float] = None
    results: List[Dict[str, Any]]
    keywords: List[str]
    keyword_model: str

# ---------- Endpoints ----------
@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    cleaned_text = normalize_text(request.text)

    language = request.language
    if language is None:
        detection = await detect_language(cleaned_text)
        language = detection["language"]
        logger.debug(f"Detected language: {language} (conf: {detection['confidence']})")

    sentiment_result = await analyze_sentiment(cleaned_text, language)
    keywords = await extract_keywords(cleaned_text, language, top_n=5)

    return AnalyzeResponse(
        sentiment=sentiment_result["sentiment"],
        confidence=sentiment_result["confidence"],
        keywords=keywords,
        language=language,
        sentiment_model=sentiment_result["model"],
        keyword_model="remote_keybert" if AI_MODE == "remote" else "local_keybert"
    )

@app.post("/suggest-topics", response_model=SuggestTopicsResponse)
async def suggest_topics(request: SuggestTopicsRequest):
    cleaned_text = normalize_text(request.text)
    result = await get_topics(cleaned_text)
    return SuggestTopicsResponse(topics=result["topics"])

@app.post("/benchmark", response_model=BenchmarkResponse)
async def benchmark_models(request: BenchmarkRequest):
    raise HTTPException(status_code=501, detail="Benchmark not implemented in this mode.")

@app.get("/health")
async def health():
    return {"status": "ok"}