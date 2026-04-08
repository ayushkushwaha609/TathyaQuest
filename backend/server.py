from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Security, Header
from fastapi.security import APIKeyHeader
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional
import hashlib
import hmac as hmac_lib
import tempfile
import json
import re
import httpx
import razorpay
from groq import Groq
from duckduckgo_search import DDGS
from urllib.parse import quote as url_quote, urlparse
from datetime import datetime, timezone, timedelta
import time
import asyncio
import secrets
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from google import genai
from google.genai import types as genai_types

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    raise RuntimeError("MONGO_URL environment variable is required but not set.")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'tathya_db')]

# API Keys
GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
SARVAM_API_KEY = os.environ.get('SARVAM_API_KEY')
RAPIDAPI_KEY = os.environ.get('RAPIDAPI_KEY')

# Instagram: multiple keys for rotation (high request volume)
_keys_env = os.environ.get('RAPIDAPI_KEYS', '')
RAPIDAPI_KEYS = [k.strip() for k in _keys_env.split(',') if k.strip()] or ([RAPIDAPI_KEY] if RAPIDAPI_KEY else [])

# YouTube: single dedicated key
RAPIDAPI_KEY_YOUTUBE = os.environ.get('RAPIDAPI_KEY_YOUTUBE', RAPIDAPI_KEY or (RAPIDAPI_KEYS[0] if RAPIDAPI_KEYS else ''))

# Ensure RAPIDAPI_KEY always has a value (fallback to first rotated key)
if not RAPIDAPI_KEY and RAPIDAPI_KEYS:
    RAPIDAPI_KEY = RAPIDAPI_KEYS[0]

# Initialize Groq client
groq_client = Groq(api_key=GROQ_API_KEY)

# Initialize Gemini client
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# API key authentication
APP_API_KEY = os.environ.get('APP_API_KEY', '')
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str = Security(api_key_header)):
    if not APP_API_KEY:
        return  # No key configured = skip auth (dev mode)
    if api_key != APP_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing API key")

# Google OAuth config
GOOGLE_CLIENT_ID_WEB = os.environ.get('GOOGLE_CLIENT_ID_WEB', '')
GOOGLE_CLIENT_ID_ANDROID = os.environ.get('GOOGLE_CLIENT_ID_ANDROID', '')

# Daily usage limits — login is required; these apply to all authenticated (free) users
DAILY_LIMIT_YT = int(os.environ.get('DAILY_LIMIT_YT', '3'))
DAILY_LIMIT_IG = int(os.environ.get('DAILY_LIMIT_IG', '3'))

# Exempt devices and emails (unlimited checks)
_exempt_devices_env = os.environ.get('EXEMPT_DEVICE_IDS', '')
EXEMPT_DEVICE_IDS = {d.strip() for d in _exempt_devices_env.split(',') if d.strip()}
_exempt_emails_env = os.environ.get('EXEMPT_EMAILS', '')
EXEMPT_EMAILS = {e.strip().lower() for e in _exempt_emails_env.split(',') if e.strip()}

# Razorpay config
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
RAZORPAY_PLAN_ID = os.environ.get('RAZORPAY_PLAN_ID', '')
RAZORPAY_WEBHOOK_SECRET = os.environ.get('RAZORPAY_WEBHOOK_SECRET', '')
rzp_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)) if RAZORPAY_KEY_ID else None

SERPER_API_KEY = os.environ.get('SERPER_API_KEY', '')

# Admin account (manual email/password login)
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', '')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')

# IST timezone
IST = timezone(timedelta(hours=5, minutes=30))

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# Shared httpx client for connection pooling (created on first use)
_http_client: httpx.AsyncClient | None = None

async def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=10.0),
            limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
            follow_redirects=True,
        )
    return _http_client

# Create the main app
app = FastAPI(title="Tathya API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# MongoDB collections
checks_collection = db["checks"]
devices_collection = db["devices"]
usage_collection = db["usage_log"]
subscriptions_collection = db["subscriptions"]

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Opinion indicator phrases (English, Hindi, Urdu-influenced, Hinglish)
OPINION_KEYWORDS = [
    # English
    "in my opinion", "in my view", "i believe", "i think", "i feel",
    "personally", "from my experience", "from my perspective", "it's my view",
    "as far as i'm concerned", "i would say", "to me it seems", "my take is",
    "i'd argue", "i reckon", "in my estimation", "it seems to me",
    "i'm of the opinion", "based on my experience", "i've always felt",
    "my personal opinion", "i personally feel", "the way i see it",
    "in my humble opinion", "speaking for myself", "it is my belief",
    # Hindi
    "mere hisab se", "mera manna hai", "main manta hun", "jahan tak mujhe lagta hai",
    "jahan tak mera manna hai", "mere anusaar", "meri rai mein", "mera khyal hai",
    "mere nazariye se", "mujhe lagta hai", "mere experience mein", "main samajhta hun",
    "meri samajh mein", "mere ko lagta hai", "meri soch mein", "mere hisaab mein",
    "main yeh maanta hun", "meri personal opinion hai", "mere vichar mein",
    "meri drishti mein", "mere mantavya mein", "mere anubhav mein",
    # Urdu-influenced
    "meri rai ye hai", "mere mutabiq", "mera guman hai", "meri nazar mein",
    "mere khayal mein", "meri qaum mein",
    # Hinglish
    "personally mujhe lagta hai", "my personal view hai", "mere hisab se dekho",
    "mere experience se", "i personally manta hun", "mera personal opinion hai",
    "mere hisab se baat karu to",
]

# Localized opinion messages shown to users when content is pure opinion
OPINION_MESSAGES = {
    "english": (
        "This video expresses a personal opinion or belief. "
        "TathyaCheck can only verify factual claims — statements that can be proven true or false. "
        "No verifiable facts were identified in this content."
    ),
    "hindi": (
        "यह वीडियो एक व्यक्तिगत राय या विश्वास व्यक्त करता है। "
        "TathyaCheck केवल तथ्यात्मक दावों की जाँच कर सकता है — ऐसे कथन जिन्हें सच या झूठ साबित किया जा सके। "
        "इस सामग्री में कोई सत्यापन योग्य तथ्य नहीं मिले।"
    ),
    "tamil": (
        "இந்த வீடியோ ஒரு தனிப்பட்ட கருத்தை வெளிப்படுத்துகிறது. "
        "TathyaCheck மட்டுமே நிரூபிக்கக்கூடிய உண்மைகளை சரிபார்க்க முடியும். "
        "இந்த உள்ளடக்கத்தில் சரிபார்க்கக்கூடிய வாதங்கள் எதுவும் இல்லை."
    ),
    "telugu": (
        "ఈ వీడియో వ్యక్తిగత అభిప్రాయాన్ని వ్యక్తపరుస్తోంది. "
        "TathyaCheck కేవలం నిరూపించదగిన వాస్తవాలను మాత్రమే ధృవీకరించగలదు. "
        "ఈ కంటెంట్‌లో ధృవీకరించదగిన వాస్తవాలు ఏవీ కనుగొనబడలేదు."
    ),
    "kannada": (
        "ಈ ವೀಡಿಯೊ ವ್ಯಕ್ತಿಗತ ಅಭಿಪ್ರಾಯವನ್ನು ವ್ಯಕ್ತಪಡಿಸುತ್ತದೆ. "
        "TathyaCheck ಮಾತ್ರ ಸಾಬೀತುಪಡಿಸಬಹುದಾದ ಸತ್ಯಗಳನ್ನು ಪರಿಶೀಲಿಸಬಲ್ಲದು. "
        "ಈ ವಿಷಯದಲ್ಲಿ ಯಾವುದೇ ಪರಿಶೀಲಿಸಬಹುದಾದ ಸತ್ಯಗಳು ಕಂಡುಬಂದಿಲ್ಲ."
    ),
    "malayalam": (
        "ഈ വീഡിയോ ഒരു വ്യക്തിഗത അഭിപ്രായം പ്രകടിപ്പിക്കുന്നു. "
        "TathyaCheck-ന് മാത്രമേ തെളിയിക്കാവുന്ന വസ്തുതകൾ പരിശോധിക്കാൻ കഴിയൂ. "
        "ഈ ഉള്ളടക്കത്തിൽ പരിശോധിക്കാവുന്ന വസ്തുതകൾ ഒന്നും കണ്ടെത്തിയില്ല."
    ),
    "marathi": (
        "हा व्हिडिओ एक वैयक्तिक मत व्यक्त करतो. "
        "TathyaCheck केवळ सिद्ध करता येण्याजोग्या तथ्यात्मक दाव्यांची तपासणी करू शकतो. "
        "या सामग्रीमध्ये कोणतेही सत्यापन करण्यायोग्य तथ्य आढळले नाही."
    ),
    "bengali": (
        "এই ভিডিওটি একটি ব্যক্তিগত মতামত প্রকাশ করে। "
        "TathyaCheck শুধুমাত্র প্রমাণযোগ্য তথ্যমূলক দাবিগুলি যাচাই করতে পারে। "
        "এই বিষয়বস্তুতে কোনো যাচাইযোগ্য তথ্য পাওয়া যায়নি।"
    ),
    "gujarati": (
        "આ વિડિઓ એક વ્યક્તિગત અભિપ્રાય વ્યક્ત કરે છે. "
        "TathyaCheck ફક્ત સાબિત કરી શકાય તેવા તથ્યાત્મક દાવાઓ ચકાસી શકે છે. "
        "આ સામગ્રીમાં કોઈ ચકાસી શકાય તેવા તથ્યો મળ્યા નથી."
    ),
}

# Language mapping
LANGUAGE_MAP = {
    "en-IN": ("english", "English"),
    "hi-IN": ("hindi", "Hindi"),
    "ta-IN": ("tamil", "Tamil"),
    "te-IN": ("telugu", "Telugu"),
    "kn-IN": ("kannada", "Kannada"),
    "ml-IN": ("malayalam", "Malayalam"),
    "mr-IN": ("marathi", "Marathi"),
    "bn-IN": ("bengali", "Bengali"),
    "gu-IN": ("gujarati", "Gujarati"),
}

# Pydantic Models
class CheckRequest(BaseModel):
    url: str = Field(..., max_length=2048)
    language_code: str = "hi-IN"

class CheckResponse(BaseModel):
    claim: str
    claim_regional: str = ""  # Claim in regional language
    verdict: str
    confidence: int
    reason: str
    reason_regional: str = ""  # Quick verdict in regional language
    verdict_text: str  # This will now contain both English and regional language
    verdict_text_english: str = ""  # English version
    verdict_text_regional: str = ""  # Regional language version
    audio_base64: Optional[str] = None
    # Enhanced context fields
    category: str = "general"  # health, science, history, technology, finance, news, general
    key_points: list = []  # Main points extracted from the video (English)
    key_points_regional: list = []  # Key points in regional language
    fact_details: str = ""  # Detailed explanation of facts (English)
    fact_details_regional: str = ""  # Facts in regional language
    what_to_know: str = ""  # What the user should know (English)
    what_to_know_regional: str = ""  # What to know in regional language
    sources_note: str = ""  # Note about verification sources
    why_misleading: str = ""  # Explanation of why something is misleading (if applicable)
    why_misleading_regional: str = ""  # Why misleading in regional language

class ErrorResponse(BaseModel):
    error: str
    message: str

# Helper Functions
def get_cache_key(url: str, language_code: str) -> str:
    return hashlib.sha256(f"{url}:{language_code}".encode()).hexdigest()

def validate_url(url: str) -> bool:
    """Validate if URL is from Instagram or YouTube by checking the actual hostname"""
    try:
        parsed = urlparse(url)
        hostname = (parsed.hostname or '').lower()
        allowed_hosts = {
            'instagram.com', 'www.instagram.com', 'instagr.am',
            'youtube.com', 'www.youtube.com', 'youtu.be',
            'm.youtube.com', 'music.youtube.com',
        }
        return hostname in allowed_hosts and parsed.scheme in ('http', 'https')
    except Exception:
        return False

def is_youtube_url(url: str) -> bool:
    """Check if URL is from YouTube"""
    return bool(re.search(r'(youtube\.com|youtu\.be)', url))

def is_instagram_url(url: str) -> bool:
    """Check if URL is from Instagram"""
    return bool(re.search(r'(instagram\.com|instagr\.am)', url))

def extract_instagram_reel_url(url: str) -> Optional[str]:
    """Extract and normalize Instagram Reel URL"""
    # Match various Instagram Reel URL formats
    patterns = [
        r'(instagram\.com/reel/[A-Za-z0-9_-]+)',
        r'(instagram\.com/reels/[A-Za-z0-9_-]+)',
        r'(instagram\.com/p/[A-Za-z0-9_-]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return f"https://www.{match.group(1)}/"
    return url  # Return original URL if no match

async def extract_audio_instagram(url: str, output_dir: str) -> str:
    """Extract audio from Instagram Reel using RapidAPI with key rotation"""
    logger.info(f"Fetching Instagram Reel via RapidAPI: {url}")

    client = await get_http_client()

    for i, api_key in enumerate(RAPIDAPI_KEYS):
        try:
            logger.info(f"Trying instagram-reels-downloader-api with key {i+1}/{len(RAPIDAPI_KEYS)}...")
            response = await client.get(
                "https://instagram-reels-downloader-api.p.rapidapi.com/download",
                params={"url": url},
                headers={
                    "X-RapidAPI-Key": api_key,
                    "X-RapidAPI-Host": "instagram-reels-downloader-api.p.rapidapi.com"
                },
                timeout=60.0
            )

            logger.info(f"Key {i+1} response: {response.status_code}")

            if response.status_code in (429, 403):
                logger.warning(f"Key {i+1}: quota/auth error ({response.status_code}), trying next key...")
                continue

            if response.status_code == 200:
                data = response.json()
                logger.info(f"API response success: {data.get('success')}")

                if data.get("success") and data.get("data", {}).get("medias"):
                    medias = data["data"]["medias"]

                    # Try to find audio-only track first (better for transcription)
                    audio_url = None
                    video_url = None

                    for media in medias:
                        if media.get("is_audio") and media.get("type") == "audio":
                            audio_url = media.get("url")
                            logger.info(f"Found audio track: {audio_url[:100]}...")
                            break
                        elif media.get("type") == "video" and media.get("url"):
                            video_url = media.get("url")

                    download_url = audio_url or video_url
                    if download_url:
                        logger.info(f"Downloading media from: {download_url[:100]}...")
                        media_response = await client.get(download_url, follow_redirects=True, timeout=60.0)

                        if media_response.status_code == 200 and len(media_response.content) > 1000:
                            if audio_url:
                                audio_path = os.path.join(output_dir, "audio.m4a")
                                with open(audio_path, "wb") as f:
                                    f.write(media_response.content)
                                logger.info(f"Audio saved: {audio_path}, size: {len(media_response.content)} bytes")
                                return audio_path
                            else:
                                video_path = os.path.join(output_dir, "video.mp4")
                                audio_path = os.path.join(output_dir, "audio.mp3")

                                with open(video_path, "wb") as f:
                                    f.write(media_response.content)
                                logger.info(f"Video saved: {video_path}, size: {len(media_response.content)} bytes")

                                try:
                                    proc = await asyncio.create_subprocess_exec(
                                        "ffmpeg", "-i", video_path, "-vn", "-acodec", "libmp3lame", "-q:a", "4", audio_path, "-y",
                                        stdout=asyncio.subprocess.PIPE,
                                        stderr=asyncio.subprocess.PIPE,
                                    )
                                    await asyncio.wait_for(proc.communicate(), timeout=30)
                                    if os.path.exists(audio_path) and os.path.getsize(audio_path) > 1000:
                                        logger.info(f"Audio extracted: {audio_path}")
                                        return audio_path
                                except Exception as e:
                                    logger.warning(f"FFmpeg error: {e}")
                                return video_path
                        else:
                            logger.warning(f"Failed to download media: status={media_response.status_code}")
                    else:
                        logger.warning("No media URL found in response")
                else:
                    error_msg = data.get("message", "Unknown error")
                    logger.warning(f"Key {i+1} API error: {error_msg}")
            else:
                logger.warning(f"Key {i+1}: HTTP {response.status_code} - {response.text[:200]}")

        except Exception as e:
            logger.warning(f"Key {i+1} failed with exception: {e}")

    raise Exception("Could not download Instagram Reel. All API keys exhausted. Please make sure the reel is public and try again.")

def extract_youtube_video_id(url: str) -> Optional[str]:
    """Extract video ID from various YouTube URL formats"""
    patterns = [
        r'(?:youtube\.com/shorts/)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com/watch\?v=)([a-zA-Z0-9_-]{11})',
        r'(?:youtu\.be/)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com/embed/)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com/v/)([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

async def _try_youtube_mp310(client, youtube_url: str, api_key: str, output_dir: str) -> str | None:
    """Try youtube-mp310 API. Returns audio path on success, None on failure."""
    try:
        response = await client.get(
            "https://youtube-mp310.p.rapidapi.com/download/mp3",
            params={"url": youtube_url},
            headers={"X-RapidAPI-Key": api_key, "X-RapidAPI-Host": "youtube-mp310.p.rapidapi.com"},
            timeout=60.0
        )
        if response.status_code in (403, 429):
            return None
        logger.info(f"youtube-mp310 status: {response.status_code}, body: {response.text[:200]}")
        if response.status_code == 200:
            mp3_url = response.text.strip()
            if mp3_url and mp3_url.startswith("http"):
                mp3_response = await client.get(mp3_url, follow_redirects=True, timeout=60.0)
                if mp3_response.status_code == 200 and len(mp3_response.content) > 1000:
                    output_path = os.path.join(output_dir, "audio.mp3")
                    with open(output_path, "wb") as f:
                        f.write(mp3_response.content)
                    logger.info(f"Audio saved from mp310: {output_path}, size: {len(mp3_response.content)} bytes")
                    return output_path
    except Exception as e:
        logger.warning(f"youtube-mp310 failed: {e}")
    return None

async def _try_youtube_mp3_2025(client, video_id: str, api_key: str, output_dir: str) -> str | None:
    """Try youtube-mp3-2025 API. Returns audio path on success, None on failure."""
    try:
        response = await client.get(
            "https://youtube-mp3-2025.p.rapidapi.com/download",
            params={"id": video_id},
            headers={"X-RapidAPI-Key": api_key, "X-RapidAPI-Host": "youtube-mp3-2025.p.rapidapi.com"},
            timeout=60.0
        )
        if response.status_code in (403, 429):
            return None
        logger.info(f"youtube-mp3-2025 status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            mp3_url = data.get("link") or data.get("download") or data.get("url")
            if mp3_url and mp3_url.startswith("http"):
                mp3_response = await client.get(mp3_url, follow_redirects=True, timeout=60.0)
                if mp3_response.status_code == 200 and len(mp3_response.content) > 1000:
                    output_path = os.path.join(output_dir, "audio.mp3")
                    with open(output_path, "wb") as f:
                        f.write(mp3_response.content)
                    logger.info(f"Audio saved from mp3-2025: {output_path}")
                    return output_path
    except Exception as e:
        logger.warning(f"youtube-mp3-2025 failed: {e}")
    return None

async def _try_youtube_mp36(client, video_id: str, api_key: str, output_dir: str) -> str | None:
    """Try youtube-mp36 API with retry logic. Returns audio path on success, None on failure."""
    max_retries = 3
    retry_delay = 5
    for attempt in range(max_retries):
        try:
            response = await client.get(
                "https://youtube-mp36.p.rapidapi.com/dl",
                params={"id": video_id},
                headers={"X-RapidAPI-Key": api_key, "X-RapidAPI-Host": "youtube-mp36.p.rapidapi.com"},
            )
            if response.status_code in (403, 429):
                return None
            if response.status_code == 200:
                data = response.json()
                status = data.get("status", "").lower()
                logger.info(f"youtube-mp36 attempt {attempt + 1}: status={status}")
                if status == "ok" and data.get("link"):
                    mp3_url = data["link"]
                    mp3_response = await client.get(
                        mp3_url, follow_redirects=True, timeout=60.0,
                        headers={
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                            "Referer": "https://youtube-mp36.p.rapidapi.com/"
                        }
                    )
                    if mp3_response.status_code == 200 and len(mp3_response.content) > 1000:
                        output_path = os.path.join(output_dir, "audio.mp3")
                        with open(output_path, "wb") as f:
                            f.write(mp3_response.content)
                        logger.info(f"Audio saved from mp36: {output_path}")
                        return output_path
                elif status in ["processing", "in process"]:
                    logger.info(f"Video processing, waiting {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                    continue
        except Exception as e:
            logger.warning(f"youtube-mp36 attempt {attempt + 1} failed: {e}")
        await asyncio.sleep(retry_delay)
    return None

async def extract_audio_rapidapi(video_id: str, output_dir: str) -> str:
    """Extract audio from YouTube using dedicated YouTube RapidAPI key"""
    logger.info(f"Fetching audio via RapidAPI for video ID: {video_id}")
    youtube_url = f"https://www.youtube.com/watch?v={video_id}"
    client = await get_http_client()
    api_key = RAPIDAPI_KEY_YOUTUBE

    result = await _try_youtube_mp310(client, youtube_url, api_key, output_dir)
    if result:
        return result

    result = await _try_youtube_mp3_2025(client, video_id, api_key, output_dir)
    if result:
        return result

    result = await _try_youtube_mp36(client, video_id, api_key, output_dir)
    if result:
        return result

    raise Exception("Could not extract audio. Please try a different video.")

async def transcribe_audio(audio_path: str) -> str:
    """Transcribe audio using Groq Whisper (offloaded to thread to avoid blocking event loop)"""
    file_size = os.path.getsize(audio_path)
    # Estimate duration: assume ~128kbps for mp3, ~96kbps for m4a
    bitrate = 96000 if audio_path.endswith('.m4a') else 128000
    estimated_seconds = (file_size * 8) / bitrate
    logger.info(f"Audio file: {audio_path}, size: {file_size} bytes, estimated duration: {estimated_seconds:.1f}s")

    def _sync_transcribe():
        with open(audio_path, "rb") as audio_file:
            return groq_client.audio.transcriptions.create(
                file=(os.path.basename(audio_path), audio_file.read()),
                model="whisper-large-v3",
                response_format="text",
            )
    return await asyncio.to_thread(_sync_transcribe)

async def extract_search_queries(transcript: str) -> list[str]:
    """Extract up to 3 key factual claims from the full transcript for multi-topic web searching"""
    try:
        def _sync_extract():
            return groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": (
                        "Read the ENTIRE transcript carefully from start to finish. "
                        "Identify up to 3 distinct factual claims made throughout the video — cover ALL topics discussed, not just the first one. "
                        "YOU MUST RESPOND IN ENGLISH ONLY — translate claims to English if the transcript is in another language. "
                        "Return ONLY a numbered list, one claim per line in English (max 15 words each), like:\n"
                        "1. <claim one in English>\n2. <claim two in English>\n3. <claim three in English>"
                    )},
                    {"role": "user", "content": transcript[:8000]}
                ],
                temperature=0.0,
                max_tokens=120,
            )
        response = await asyncio.to_thread(_sync_extract)
        raw = response.choices[0].message.content.strip()
        queries = []
        for line in raw.splitlines():
            line = line.strip().lstrip("123456789.-) ").strip().strip('"')
            if line:
                queries.append(line)
        queries = queries[:3]
        logger.info(f"Extracted search queries: {queries}")
        return queries
    except Exception as e:
        logger.warning(f"Failed to extract search queries: {e}")
        return []

async def web_search(query: str, timeout: float = 6.0) -> str:
    """Search the web for fact-checking context.
    Uses Serper.dev (async HTTP) if API key is set, falls back to DuckDuckGo.
    """
    if not query:
        return ""

    # --- Serper.dev (preferred: native async, reliable) ---
    if SERPER_API_KEY:
        try:
            client = await get_http_client()
            response = await asyncio.wait_for(
                client.post(
                    "https://google.serper.dev/search",
                    headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
                    json={"q": query, "num": 5, "gl": "in", "hl": "en"},
                ),
                timeout=timeout,
            )
            if response.status_code == 200:
                data = response.json()
                snippets = []
                for r in data.get("organic", []):
                    title = r.get("title", "")
                    snippet = r.get("snippet", "")
                    link = r.get("link", "")
                    snippets.append(f"- {title}: {snippet} (Source: {link})")
                if snippets:
                    return "\n".join(snippets)
                logger.warning(f"Serper returned no results for: {query}")
            else:
                logger.warning(f"Serper error {response.status_code} for: {query}")
        except asyncio.TimeoutError:
            logger.warning(f"Serper search timed out after {timeout}s for: {query}")
        except Exception as e:
            logger.warning(f"Serper search failed: {e}")

    # --- DuckDuckGo fallback ---
    try:
        def _sync_search():
            with DDGS() as ddgs:
                return list(ddgs.text(query, max_results=5))
        results = await asyncio.wait_for(asyncio.to_thread(_sync_search), timeout=timeout)
        if not results:
            logger.warning(f"DuckDuckGo returned no results for: {query}")
            return ""
        snippets = []
        for r in results:
            title = r.get("title", "")
            body = r.get("body", "")
            href = r.get("href", "")
            snippets.append(f"- {title}: {body} (Source: {href})")
        return "\n".join(snippets)
    except asyncio.TimeoutError:
        logger.warning(f"DuckDuckGo search timed out after {timeout}s for: {query}")
        return ""
    except Exception as e:
        logger.warning(f"DuckDuckGo search failed: {e}")
        return ""

async def fact_check_transcript(transcript: str, language_code: str) -> dict:
    """Fact-check the transcript using DuckDuckGo Search + Groq Llama"""
    transcript = transcript[:12000]

    lang_key, language_name = LANGUAGE_MAP.get(language_code, ("hindi", "Hindi"))

    # Step 1: Extract ALL key claims, then run parallel web searches for each
    search_queries = await extract_search_queries(transcript)
    if search_queries:
        web_results = await asyncio.gather(*[web_search(q, timeout=8.0) for q in search_queries], return_exceptions=True)
        web_results = [r if isinstance(r, str) else "" for r in web_results]
        combined_web_context = ""
        for i, (q, ctx) in enumerate(zip(search_queries, web_results)):
            if ctx:
                combined_web_context += f"\n[Search {i+1}: \"{q}\"]\n{ctx}\n"
    else:
        combined_web_context = ""

    web_context_block = ""
    if combined_web_context:
        web_context_block = f"""\n\nWEB SEARCH RESULTS (use these to verify ALL claims against current real-world information):
\"\"\"
{combined_web_context}
\"\"\"\n"""

    opinion_keywords_str = ", ".join(f'"{k}"' for k in OPINION_KEYWORDS)
    system_prompt = f"""You are an expert fact-checker with broad knowledge across health, nutrition, medicine, fitness, traditional medicine, science, history, technology, finance, law, and general knowledge. Your primary focus is general fact-checking: health tips, medical information, and factual claims.

CRITICAL RULES:
1. Read the ENTIRE transcript from start to finish. Identify EVERY distinct factual claim made throughout the video — do NOT stop at the first topic.
2. Fact-check ALL claims found across the whole video, not just the opening claim.
3. Be OBJECTIVE — only check verifiable facts, not opinions or predictions.
4. Your confidence score must use precise numbers (e.g., 73, 87, 91) — NOT round numbers like 50, 60, 70.
5. For key_points: each item must follow format "CLAIM: <claim text> → VERDICT: <TRUE/FALSE/MISLEADING/PARTIALLY_TRUE> — <one sentence reason>"
6. USE the web search results (provided per claim) to verify against up-to-date information.
7. If any single claim is FALSE or MISLEADING, the overall verdict must reflect that.
8. The overall verdict should be the WORST verdict across all individual claims (e.g., if one claim is FALSE and another TRUE, overall = FALSE).
9. OPINION DETECTION: If the video's PRIMARY content is personal opinions, subjective views, or beliefs with no verifiable factual claims — especially when the speaker uses phrases like {opinion_keywords_str} — return verdict "OPINION". However, if factual claims are embedded within opinion framing (e.g. "I believe turmeric cures cancer"), fact-check the embedded factual claim instead of returning OPINION.

Always return ONLY valid JSON. No explanation outside the JSON object."""

    is_english_only = (lang_key == "english")

    if is_english_only:
        json_template = """{
  "claim": "Overall summary: the video makes N claims about [topics]. Example: 'Video makes 2 claims: X and Y'. If verdict is OPINION, summarise what opinion is expressed.",
  "verdict": "TRUE" or "FALSE" or "MISLEADING" or "PARTIALLY_TRUE" or "OPINION",
  "confidence": integer 0-100 (set to 0 if verdict is OPINION),
  "category": "nutrition" or "medicine" or "fitness" or "ayurveda_traditional" or "mental_health" or "science" or "history" or "technology" or "finance_economy" or "law_rights" or "general",
  "key_points": [
    "CLAIM: <first claim> → VERDICT: <verdict> — <reason>",
    "CLAIM: <second claim> → VERDICT: <verdict> — <reason>",
    "CLAIM: <third claim if any> → VERDICT: <verdict> — <reason>"
  ],
  "reason": "1-2 sentences explaining the overall verdict across ALL claims",
  "why_misleading": "If any claim is MISLEADING/PARTIALLY_TRUE/FALSE: explain which claim and why. Otherwise empty string.",
  "fact_details": "2-3 sentences covering the actual facts for ALL claims discussed",
  "what_to_know": "1-2 sentences of practical advice covering all topics in the video",
  "sources_note": "Brief source note",
  "verdict_spoken": "2-3 sentence spoken summary covering ALL claims in the video"
}"""
        language_instruction = "Provide ALL content in English."
    else:
        json_template = f"""{{
  "claim": "Overall summary of ALL claims in video (English). If verdict is OPINION, summarise what opinion is expressed.",
  "claim_{lang_key}": "Same summary in {language_name}",
  "verdict": "TRUE" or "FALSE" or "MISLEADING" or "PARTIALLY_TRUE" or "OPINION",
  "confidence": integer 0-100 (set to 0 if verdict is OPINION),
  "category": "nutrition" or "medicine" or "fitness" or "ayurveda_traditional" or "mental_health" or "science" or "history" or "technology" or "finance_economy" or "law_rights" or "general",
  "key_points": [
    "CLAIM: <first claim> → VERDICT: <verdict> — <reason>",
    "CLAIM: <second claim> → VERDICT: <verdict> — <reason>",
    "CLAIM: <third claim if any> → VERDICT: <verdict> — <reason>"
  ],
  "key_points_{lang_key}": [
    "दावा: <first claim in {language_name}> → निर्णय: <verdict> — <reason in {language_name}>",
    "दावा: <second claim in {language_name}> → निर्णय: <verdict> — <reason in {language_name}>"
  ],
  "reason": "1-2 sentences explaining overall verdict across ALL claims (English)",
  "reason_{lang_key}": "Same in {language_name}",
  "why_misleading": "Which specific claim is misleading/false and why (English). Empty string if all TRUE.",
  "why_misleading_{lang_key}": "Same in {language_name} or empty string",
  "fact_details": "2-3 sentences covering actual facts for ALL claims (English)",
  "fact_details_{lang_key}": "Same in {language_name}",
  "what_to_know": "1-2 sentences of practical advice covering all topics (English)",
  "what_to_know_{lang_key}": "Same in {language_name}",
  "sources_note": "Brief source note (English only)",
  "verdict_english": "2-3 sentence spoken summary covering ALL claims in English",
  "verdict_{lang_key}": "Same 2-3 sentence summary in {language_name}"
}}"""
        language_instruction = f"Provide ALL content in BOTH English AND {language_name}."

    user_prompt = f"""Read this COMPLETE video transcript from start to finish:
\"\"\"
{transcript}
\"\"\"
{web_context_block}
TASK: Identify and fact-check EVERY distinct factual claim made throughout the ENTIRE video. Cover ALL topics discussed — do not focus only on the first topic. Use the web search results above (one set per claim) to verify each claim against real-world information.

IMPORTANT: {language_instruction}

Return ONLY this JSON with no other text:
{json_template}
"""

    def _sync_fact_check():
        return groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2,
            max_tokens=4000,
        )
    response = await asyncio.to_thread(_sync_fact_check)

    response_text = response.choices[0].message.content.strip()
    return _parse_fact_check_json(response_text, lang_key, language_name)

def _parse_fact_check_json(response_text: str, lang_key: str, language_name: str) -> dict:
    """Shared JSON parsing/repair logic for fact-check responses (Groq or Gemini)."""
    try:
        # Try to extract JSON if wrapped in markdown code blocks
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        # Try to repair truncated JSON
        if not response_text.rstrip().endswith("}"):
            logger.warning("JSON appears truncated, attempting repair...")
            open_braces = response_text.count('{') - response_text.count('}')
            open_brackets = response_text.count('[') - response_text.count(']')

            in_string = False
            for i, char in enumerate(response_text):
                if char == '"' and (i == 0 or response_text[i-1] != '\\'):
                    in_string = not in_string

            if in_string:
                response_text += '"'

            response_text += ']' * open_brackets
            response_text += '}' * open_braces
            logger.info("Repaired truncated JSON response")

        result = json.loads(response_text)

        is_english_only = (lang_key == "english")

        # Handle OPINION verdict — override verdict_text with localized message
        if result.get("verdict") == "OPINION":
            opinion_msg_en = OPINION_MESSAGES.get("english", "")
            opinion_msg_regional = OPINION_MESSAGES.get(lang_key, opinion_msg_en)
            combined = f"{opinion_msg_en}\n\n{opinion_msg_regional}" if not is_english_only else opinion_msg_en
            return {
                "claim": result.get("claim", "Personal opinion expressed"),
                "claim_regional": result.get(f"claim_{lang_key}", result.get("claim", "")) if not is_english_only else result.get("claim", "Personal opinion expressed"),
                "verdict": "OPINION",
                "confidence": 0,
                "reason": opinion_msg_en,
                "reason_regional": opinion_msg_regional if not is_english_only else opinion_msg_en,
                "verdict_text": combined,
                "verdict_text_english": opinion_msg_en,
                "verdict_text_regional": opinion_msg_regional if not is_english_only else opinion_msg_en,
                "category": result.get("category", "general"),
                "key_points": [],
                "key_points_regional": [],
                "fact_details": "",
                "fact_details_regional": "",
                "what_to_know": "",
                "what_to_know_regional": "",
                "sources_note": "",
                "why_misleading": "",
                "why_misleading_regional": ""
            }

        if is_english_only:
            verdict_text_english = result.get("verdict_spoken", result.get("reason", ""))
            verdict_text_regional = verdict_text_english
            combined_verdict_text = verdict_text_english
        else:
            verdict_key = f"verdict_{lang_key}"
            verdict_text_english = result.get("verdict_english", result.get("reason", ""))
            verdict_text_regional = result.get(verdict_key, result.get("reason", ""))
            combined_verdict_text = f"{verdict_text_english}\n\n{verdict_text_regional}"

        # Ensure confidence is not a round number
        confidence = int(result.get("confidence", 50))
        if confidence % 10 == 0 and confidence > 0 and confidence < 100:
            import random
            confidence = confidence + random.choice([-3, -2, -1, 1, 2, 3])
            confidence = max(1, min(99, confidence))

        if is_english_only:
            return {
                "claim": result.get("claim", "Could not identify claim"),
                "claim_regional": result.get("claim", ""),
                "verdict": result.get("verdict", "MISLEADING"),
                "confidence": confidence,
                "reason": result.get("reason", "Analysis inconclusive"),
                "reason_regional": result.get("reason", ""),
                "verdict_text": combined_verdict_text,
                "verdict_text_english": verdict_text_english,
                "verdict_text_regional": verdict_text_regional,
                "category": result.get("category", "general"),
                "key_points": result.get("key_points", []),
                "key_points_regional": result.get("key_points", []),
                "fact_details": result.get("fact_details", ""),
                "fact_details_regional": result.get("fact_details", ""),
                "what_to_know": result.get("what_to_know", ""),
                "what_to_know_regional": result.get("what_to_know", ""),
                "sources_note": result.get("sources_note", ""),
                "why_misleading": result.get("why_misleading", ""),
                "why_misleading_regional": result.get("why_misleading", "")
            }
        else:
            return {
                "claim": result.get("claim", "Could not identify claim"),
                "claim_regional": result.get(f"claim_{lang_key}", ""),
                "verdict": result.get("verdict", "MISLEADING"),
                "confidence": confidence,
                "reason": result.get("reason", "Analysis inconclusive"),
                "reason_regional": result.get(f"reason_{lang_key}", ""),
                "verdict_text": combined_verdict_text,
                "verdict_text_english": verdict_text_english,
                "verdict_text_regional": verdict_text_regional,
                "category": result.get("category", "general"),
                "key_points": result.get("key_points", []),
                "key_points_regional": result.get(f"key_points_{lang_key}", []),
                "fact_details": result.get("fact_details", ""),
                "fact_details_regional": result.get(f"fact_details_{lang_key}", ""),
                "what_to_know": result.get("what_to_know", ""),
                "what_to_know_regional": result.get(f"what_to_know_{lang_key}", ""),
                "sources_note": result.get("sources_note", ""),
                "why_misleading": result.get("why_misleading", ""),
                "why_misleading_regional": result.get(f"why_misleading_{lang_key}", "")
            }
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}, Response: {response_text[:500]}...")

        error_messages = {
            "english": "Analysis failed",
            "hindi": "विश्लेषण विफल",
            "tamil": "பகுப்பாய்வு தோல்வி",
            "telugu": "విశ్లేషణ విఫలమైంది",
            "kannada": "ವಿಶ್ಲೇಷಣೆ ವಿಫಲವಾಗಿದೆ",
            "malayalam": "വിശകലനം പരാജയപ്പെട്ടു",
            "marathi": "विश्लेषण अयशस्वी",
            "bengali": "বিশ্লেষণ ব্যর্থ",
            "gujarati": "વિશ્લેષણ નિષ્ફળ",
        }
        regional_error = error_messages.get(lang_key, "विश्लेषण विफल")

        return {
            "claim": "Could not parse response",
            "claim_regional": regional_error,
            "verdict": "MISLEADING",
            "confidence": 0,
            "reason": "Failed to analyze the content",
            "reason_regional": regional_error,
            "verdict_text": f"Analysis failed\n\n{regional_error}",
            "verdict_text_english": "Analysis failed",
            "verdict_text_regional": regional_error,
            "category": "general",
            "key_points": [],
            "key_points_regional": [],
            "fact_details": "",
            "fact_details_regional": "",
            "what_to_know": "",
            "what_to_know_regional": "",
            "sources_note": "",
            "why_misleading": "",
            "why_misleading_regional": ""
        }


async def fact_check_youtube_gemini(url: str, language_code: str) -> dict:
    """Fact-check a YouTube video using Gemini 2.0 Flash (transcribe + fact-check in one shot)."""
    lang_key, language_name = LANGUAGE_MAP.get(language_code, ("hindi", "Hindi"))

    # Web search for grounding — use the YouTube URL as a search query
    # Extract a brief query from the URL or use it directly
    search_query = url
    web_context = await web_search(search_query)

    web_context_block = ""
    if web_context:
        web_context_block = f"""\n\nWEB SEARCH RESULTS (use these to verify claims against current real-world information):
\"\"\"
{web_context}
\"\"\"\n"""

    opinion_keywords_str = ", ".join(f'"{k}"' for k in OPINION_KEYWORDS)
    system_prompt = f"""You are an expert fact-checker with broad knowledge across health, nutrition, medicine, fitness, traditional medicine, science, history, technology, finance, law, and general knowledge. Your primary focus is general fact-checking: health tips, medical information, and factual claims.

IMPORTANT RULES:
1. First, carefully watch and transcribe the spoken content of the video.
2. You ONLY fact-check claims that are EXPLICITLY stated in the video. Do NOT infer or assume claims.
3. Be OBJECTIVE - stick to verifiable facts, not opinions or interpretations.
4. Your confidence score should reflect how certain you are about the factual accuracy, using precise numbers (e.g., 73, 87, 91) - NOT round numbers like 50, 60, 70.
5. If something is MISLEADING, you MUST explain exactly WHY it is misleading and what the correct information is.
6. Provide thorough, educational explanations that help users understand the truth.
7. USE the web search results provided to verify claims against up-to-date real-world information. Prefer web search evidence over your training data for current events and recent facts.
8. If web search results contradict a claim, cite the source in your sources_note.
9. OPINION DETECTION: If the video's PRIMARY content is personal opinions, subjective views, or beliefs with no verifiable factual claims — especially when the speaker uses phrases like {opinion_keywords_str} — return verdict "OPINION". However, if factual claims are embedded within opinion framing (e.g. "I believe turmeric cures cancer"), fact-check the embedded factual claim instead of returning OPINION.

Always return ONLY valid JSON. No explanation outside the JSON object."""

    is_english_only = (lang_key == "english")

    if is_english_only:
        json_template = """{
  "claim": "One clear sentence summarizing the main claim. If verdict is OPINION, summarise what opinion is expressed.",
  "verdict": "TRUE" or "FALSE" or "MISLEADING" or "PARTIALLY_TRUE" or "OPINION",
  "confidence": integer 0-100 (use specific numbers like 73, 84, 91; set to 0 if verdict is OPINION),
  "category": "nutrition" or "medicine" or "fitness" or "ayurveda_traditional" or "mental_health" or "science" or "history" or "technology" or "finance_economy" or "law_rights" or "general",
  "key_points": ["Point 1", "Point 2"],
  "reason": "1-2 sentences explaining verdict",
  "why_misleading": "If MISLEADING/PARTIALLY_TRUE: 1-2 sentences why. Otherwise empty string.",
  "fact_details": "2-3 sentences about the actual facts",
  "what_to_know": "1-2 sentences of practical advice",
  "sources_note": "Brief source note",
  "verdict_spoken": "2-3 sentence spoken explanation suitable for text-to-speech"
}"""
        language_instruction = "Provide ALL content in English. Keep responses CONCISE to fit within limits."
    else:
        json_template = f"""{{
  "claim": "One clear sentence summarizing the main claim (English). If verdict is OPINION, summarise what opinion is expressed.",
  "claim_{lang_key}": "Same claim in {language_name}",
  "verdict": "TRUE" or "FALSE" or "MISLEADING" or "PARTIALLY_TRUE" or "OPINION",
  "confidence": integer 0-100 (use specific numbers like 73, 84, 91; set to 0 if verdict is OPINION),
  "category": "nutrition" or "medicine" or "fitness" or "ayurveda_traditional" or "mental_health" or "science" or "history" or "technology" or "finance_economy" or "law_rights" or "general",
  "key_points": ["Point 1 English", "Point 2 English"],
  "key_points_{lang_key}": ["Point 1 {language_name}", "Point 2 {language_name}"],
  "reason": "1-2 sentences explaining verdict in English",
  "reason_{lang_key}": "Same in {language_name}",
  "why_misleading": "If MISLEADING/PARTIALLY_TRUE: 1-2 sentences why. Otherwise empty string.",
  "why_misleading_{lang_key}": "Same in {language_name} or empty string",
  "fact_details": "2-3 sentences about the actual facts (English)",
  "fact_details_{lang_key}": "Same in {language_name}",
  "what_to_know": "1-2 sentences of practical advice (English)",
  "what_to_know_{lang_key}": "Same in {language_name}",
  "sources_note": "Brief source note (English only)",
  "verdict_english": "2-3 sentence spoken explanation in English",
  "verdict_{lang_key}": "Same 2-3 sentence explanation in {language_name}"
}}"""
        language_instruction = f"Provide ALL content in BOTH English AND {language_name}. Keep responses CONCISE to fit within limits."

    user_prompt = f"""Watch this YouTube video carefully from START TO FINISH — every second of it, not just the beginning. Transcribe ALL spoken content in the video completely, then fact-check the claims made throughout the entire video.
{web_context_block}
TASK: Fact-check ONLY the specific claims made in this video. Use the web search results (if available) to verify claims against current real-world information. Do not evaluate opinions, predictions, or subjective statements - only verifiable factual claims.

IMPORTANT: {language_instruction}

Return ONLY this JSON with no other text:
{json_template}
"""

    try:
        logger.info(f"Fact-checking YouTube video via Gemini Flash: {url}")

        def _sync_gemini_call():
            return gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    genai_types.Content(parts=[
                        genai_types.Part.from_uri(file_uri=url, mime_type="video/*"),
                        genai_types.Part(text=f"{system_prompt}\n\n{user_prompt}"),
                    ])
                ],
                config=genai_types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=8000,
                ),
            )

        response = await asyncio.to_thread(_sync_gemini_call)
        response_text = response.text.strip()
        logger.info(f"Gemini response length: {len(response_text)} chars")

        return _parse_fact_check_json(response_text, lang_key, language_name)

    except Exception as e:
        logger.error(f"Gemini fact-check failed: {e}")
        raise  # Let the caller handle fallback


async def synthesize_speech(text: str, language_code: str) -> Optional[str]:
    """Convert text to speech using Sarvam AI TTS"""
    try:
        # Sarvam TTS has a 500 character limit - truncate if needed
        # But keep it meaningful by cutting at sentence boundaries
        if len(text) > 480:
            # Try to cut at a sentence boundary
            truncated = text[:480]
            # Find last sentence ending
            last_period = max(truncated.rfind('।'), truncated.rfind('.'), truncated.rfind('!'), truncated.rfind('?'))
            if last_period > 200:  # Make sure we have reasonable content
                text = truncated[:last_period + 1]
            else:
                text = truncated + '...'
        
        client = await get_http_client()
        if True:  # shared client
            response = await client.post(
                "https://api.sarvam.ai/text-to-speech",
                headers={"API-Subscription-Key": SARVAM_API_KEY},
                json={
                    "inputs": [text],
                    "target_language_code": language_code,
                    "speaker": "anushka",  # Compatible speaker for bulbul:v2
                    "model": "bulbul:v2",  # Stable model version
                    "pace": 1.0,
                    "enable_preprocessing": True
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                audio = data.get("audios", [None])[0]
                if audio:
                    logger.info(f"Sarvam TTS success for {language_code}, audio length: {len(audio)} chars")
                else:
                    logger.warning(f"Sarvam TTS returned empty audio for {language_code}")
                return audio
            else:
                logger.error(f"Sarvam TTS error for {language_code}: {response.status_code} - {response.text[:500]}")
                return None
    except Exception as e:
        logger.error(f"Sarvam TTS exception: {e}")
        return None

# --- Helper: get today's date in IST ---
def today_ist() -> str:
    return datetime.now(IST).strftime('%Y-%m-%d')

# --- Helper: get usage info for a device ---
async def is_device_exempt(device_id: str) -> bool:
    """Check if a device is exempt from daily limits."""
    if device_id in EXEMPT_DEVICE_IDS:
        return True
    device = await devices_collection.find_one({"device_id": device_id})
    if device:
        email = (device.get("google_email") or device.get("admin_email") or "").lower()
        if email and email in EXEMPT_EMAILS:
            return True
    return False

async def get_device_usage(device_id: str) -> dict:
    """Return per-platform usage: youtube and instagram limits/counts."""
    device = await devices_collection.find_one({"device_id": device_id})
    is_auth = bool(device and (device.get("google_id") or device.get("admin_email")))
    exempt = await is_device_exempt(device_id)

    today = today_ist()
    email = (device.get("google_email") or device.get("admin_email") or "").lower() if device else ""

    # Count usage by email so quota is shared across devices for the same account
    if is_auth and email:
        usage_filter = {"email": email, "date_ist": today}
    else:
        usage_filter = {"device_id": device_id, "date_ist": today, "email": None}

    yt_used = await usage_collection.count_documents({**usage_filter, "platform": "youtube"})
    ig_used = await usage_collection.count_documents({**usage_filter, "platform": "instagram"})
    # Legacy docs (no platform field) count against Instagram
    legacy_used = await usage_collection.count_documents({"device_id": device_id, "date_ist": today, "platform": {"$exists": False}})

    if exempt:
        yt_limit = ig_limit = 999999
    else:
        yt_limit = DAILY_LIMIT_YT
        ig_limit = DAILY_LIMIT_IG

    ig_total_used = ig_used + legacy_used

    return {
        "youtube": {
            "daily_limit": yt_limit,
            "checks_used": yt_used,
            "checks_remaining": max(0, yt_limit - yt_used),
        },
        "instagram": {
            "daily_limit": ig_limit,
            "checks_used": ig_total_used,
            "checks_remaining": max(0, ig_limit - ig_total_used),
        },
        # Backward compat flat fields (sum of both platforms)
        "daily_limit": yt_limit + ig_limit,
        "checks_used": yt_used + ig_total_used,
        "checks_remaining": max(0, yt_limit - yt_used) + max(0, ig_limit - ig_total_used),
        "is_authenticated": is_auth,
        "is_exempt": exempt,
        "email": (device.get("google_email") or device.get("admin_email") if device else None),
        "name": (device.get("google_name") or device.get("admin_name") if device else None),
    }

# --- Verify daily limit for a specific platform ---
async def verify_daily_limit(request: Request, platform: str):
    """Check if device has remaining checks for the given platform ('youtube' or 'instagram').
    Rejects unauthenticated requests — login is required to use the service.
    """
    device_id = request.headers.get("X-Device-Id")
    if not device_id:
        raise HTTPException(status_code=400, detail={"error": "missing_device_id", "message": "Device ID is required."})

    # Login is required — reject anonymous devices
    device = await devices_collection.find_one({"device_id": device_id})
    is_auth = bool(device and (device.get("google_id") or device.get("admin_email")))
    if not is_auth:
        raise HTTPException(status_code=401, detail={"error": "auth_required", "message": "Sign in with Google to use TathyaQuest."})

    # Pro subscribers bypass daily limits entirely
    google_id = device.get("google_id") if device else None
    if google_id:
        sub = await subscriptions_collection.find_one({"google_id": google_id, "status": "active"})
        if sub:
            return  # unlimited access

    usage = await get_device_usage(device_id)
    platform_usage = usage.get(platform, usage.get("instagram"))

    if platform_usage["checks_remaining"] <= 0:
        platform_label = "YouTube" if platform == "youtube" else "Instagram"
        raise HTTPException(status_code=429, detail={
            "error": "daily_limit_reached",
            "message": f"{platform_label} daily limit reached. Come back tomorrow!",
            "daily_limit": platform_usage["daily_limit"],
            "checks_used": platform_usage["checks_used"],
            "platform": platform,
        })

# --- Auth endpoints ---

class GoogleAuthRequest(BaseModel):
    id_token: str
    device_id: str

@api_router.post("/auth/google")
async def google_auth(body: GoogleAuthRequest):
    """Verify Google ID token and link device to Google account."""
    try:
        idinfo = google_id_token.verify_oauth2_token(
            body.id_token,
            google_requests.Request(),
            audience=GOOGLE_CLIENT_ID_WEB,
        )
        # Also accept Android client ID as audience
        if idinfo.get("aud") not in (GOOGLE_CLIENT_ID_WEB, GOOGLE_CLIENT_ID_ANDROID):
            raise ValueError("Invalid audience")
    except Exception as e:
        logger.error(f"Google token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid Google token")

    google_id = idinfo["sub"]
    email = idinfo.get("email", "")
    name = idinfo.get("name", "")

    await devices_collection.update_one(
        {"device_id": body.device_id},
        {"$set": {
            "google_id": google_id,
            "google_email": email,
            "google_name": name,
            "linked_at": datetime.now(timezone.utc).isoformat(),
        }, "$setOnInsert": {
            "device_id": body.device_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )

    # Link any pending subscription stored by email (subscribed before first sign-in)
    pending = await subscriptions_collection.find_one({"google_email": email, "google_id": {"$exists": False}})
    if pending:
        await subscriptions_collection.update_one(
            {"_id": pending["_id"]},
            {"$set": {"google_id": google_id}},
        )
        logger.info(f"Linked pending subscription to google_id={google_id} for {email}")

    usage = await get_device_usage(body.device_id)
    return {
        "authenticated": True,
        "email": email,
        "name": name,
        **usage,
    }

class AdminAuthRequest(BaseModel):
    email: str
    password: str
    device_id: str

@api_router.post("/auth/admin")
async def admin_auth(body: AdminAuthRequest):
    """Admin login with email/password."""
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        raise HTTPException(status_code=404, detail="Admin login not configured")

    if body.email.lower() != ADMIN_EMAIL.lower() or not secrets.compare_digest(body.password, ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await devices_collection.update_one(
        {"device_id": body.device_id},
        {"$set": {
            "admin_email": body.email.lower(),
            "admin_name": "Admin",
            "linked_at": datetime.now(timezone.utc).isoformat(),
        }, "$setOnInsert": {
            "device_id": body.device_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )

    usage = await get_device_usage(body.device_id)
    return {
        "authenticated": True,
        "email": body.email.lower(),
        "name": "Admin",
        **usage,
    }

@api_router.post("/auth/logout")
async def logout(body: dict):
    """Unlink Google account from device."""
    device_id = body.get("device_id")
    if not device_id:
        raise HTTPException(status_code=400, detail="device_id required")

    await devices_collection.update_one(
        {"device_id": device_id},
        {"$set": {"google_id": None, "google_email": None, "google_name": None, "admin_email": None, "admin_name": None}},
    )

    usage = await get_device_usage(device_id)
    return {"authenticated": False, **usage}

# --- Subscription endpoints ---

@api_router.post("/subscription/create", dependencies=[Depends(verify_api_key)])
async def create_subscription(request: Request):
    """Create a Razorpay subscription for the authenticated user."""
    if not rzp_client or not RAZORPAY_PLAN_ID:
        raise HTTPException(status_code=503, detail="Payment system not configured")

    # Identify user — supports device_id (from app) or google id_token (from website)
    device_id = request.headers.get("X-Device-Id")
    body = await request.json()
    google_id, email, name = None, "", ""

    if device_id:
        device = await devices_collection.find_one({"device_id": device_id})
        if not device or not device.get("google_id"):
            raise HTTPException(status_code=401, detail={"error": "auth_required", "message": "Sign in with Google to subscribe."})
        google_id = device["google_id"]
        email = device.get("google_email", "")
        name = device.get("google_name", "")
    elif body.get("id_token"):
        # Web checkout: verify Google token directly
        try:
            idinfo = google_id_token.verify_oauth2_token(
                body["id_token"], google_requests.Request(), audience=GOOGLE_CLIENT_ID_WEB
            )
            if idinfo.get("aud") not in (GOOGLE_CLIENT_ID_WEB, GOOGLE_CLIENT_ID_ANDROID):
                raise ValueError("Invalid audience")
        except Exception as e:
            logger.error(f"Google token verification failed for web subscription: {e}")
            raise HTTPException(status_code=401, detail="Invalid Google token")
        google_id = idinfo["sub"]
        email = idinfo.get("email", "")
        name = idinfo.get("name", "")
    else:
        raise HTTPException(status_code=400, detail="Provide X-Device-Id header or id_token in body")

    # Return existing active subscription if user is already subscribed
    existing = await subscriptions_collection.find_one({"google_id": google_id, "status": "active"})
    if existing:
        return {
            "already_subscribed": True,
            "subscription_id": existing["razorpay_subscription_id"],
            "short_url": existing.get("short_url", ""),
        }

    try:
        sub = rzp_client.subscription.create({
            "plan_id": RAZORPAY_PLAN_ID,
            "total_count": 120,
            "quantity": 1,
            "customer_notify": 1,
            "notes": {"google_id": google_id, "email": email},
        })
    except Exception as e:
        logger.error(f"Razorpay subscription creation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create subscription. Please try again.")

    await subscriptions_collection.update_one(
        {"google_id": google_id},
        {"$set": {
            "google_id": google_id,
            "google_email": email,
            "razorpay_subscription_id": sub["id"],
            "plan_id": RAZORPAY_PLAN_ID,
            "status": "created",
            "short_url": sub.get("short_url", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )

    return {
        "already_subscribed": False,
        "subscription_id": sub["id"],
        "short_url": sub.get("short_url", ""),
    }


@api_router.get("/subscription/status", dependencies=[Depends(verify_api_key)])
async def get_subscription_status(x_device_id: Optional[str] = Header(None)):
    """Return subscription tier for the device's linked Google account."""
    if not x_device_id:
        return {"plan": "free", "status": "none"}

    device = await devices_collection.find_one({"device_id": x_device_id})
    if not device or not device.get("google_id"):
        return {"plan": "free", "status": "none"}

    sub = await subscriptions_collection.find_one({"google_id": device["google_id"]})
    # Fallback: look up by email in case subscription was stored before google_id was linked
    if not sub and device.get("google_email"):
        sub = await subscriptions_collection.find_one({"google_email": device["google_email"]})
        if sub and not sub.get("google_id"):
            # Opportunistically link it now
            await subscriptions_collection.update_one(
                {"_id": sub["_id"]},
                {"$set": {"google_id": device["google_id"]}},
            )
    if not sub:
        return {"plan": "free", "status": "none"}

    return {
        "plan": "pro" if sub["status"] == "active" else "free",
        "status": sub["status"],
        "subscription_id": sub.get("razorpay_subscription_id"),
        "current_period_end": sub.get("current_period_end"),
    }


@api_router.post("/subscription/cancel", dependencies=[Depends(verify_api_key)])
async def cancel_subscription(request: Request):
    """Cancel the active subscription at end of current billing period."""
    device_id = request.headers.get("X-Device-Id")
    if not device_id:
        raise HTTPException(status_code=400, detail="Missing X-Device-Id header")

    device = await devices_collection.find_one({"device_id": device_id})
    if not device or not device.get("google_id"):
        raise HTTPException(status_code=401, detail={"error": "auth_required", "message": "Not authenticated."})

    sub = await subscriptions_collection.find_one({"google_id": device["google_id"], "status": "active"})
    if not sub:
        raise HTTPException(status_code=404, detail={"error": "no_subscription", "message": "No active subscription found."})

    try:
        # cancel_at_cycle_end=1 means access continues until period end
        rzp_client.subscription.cancel(sub["razorpay_subscription_id"], {"cancel_at_cycle_end": 1})
    except Exception as e:
        logger.error(f"Razorpay cancellation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel subscription. Please try again.")

    await subscriptions_collection.update_one(
        {"google_id": device["google_id"]},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    return {"success": True, "message": "Subscription cancelled. Access continues until end of billing period."}


@api_router.get("/usage")
async def get_usage(x_device_id: Optional[str] = Header(None)):
    """Get current usage for a device."""
    if not x_device_id:
        raise HTTPException(status_code=400, detail="X-Device-Id header required")

    # Ensure device exists
    await devices_collection.update_one(
        {"device_id": x_device_id},
        {"$setOnInsert": {"device_id": x_device_id, "google_id": None, "google_email": None, "google_name": None, "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )

    return await get_device_usage(x_device_id)

# API Endpoints
@api_router.get("/health")
async def health_check():
    return {"status": "ok"}

@api_router.post("/check", response_model=CheckResponse, dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def check_claim(request: Request, body: CheckRequest):
    """Main endpoint - fact-check a video URL"""
    url = body.url.strip()
    language_code = body.language_code
    device_id = request.headers.get("X-Device-Id")

    # Validate URL
    if not validate_url(url):
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_url", "message": "Please provide a valid Instagram or YouTube link."}
        )

    # Validate language code
    if language_code not in LANGUAGE_MAP:
        language_code = "hi-IN"  # Default to Hindi

    # Check MongoDB cache — cached hits bypass daily limit
    cache_key = get_cache_key(url, language_code)
    cached = await checks_collection.find_one({"cache_key": cache_key}, {"_id": 0})
    if cached:
        logger.info(f"MongoDB cache hit for {cache_key}")
        return CheckResponse(**{k: v for k, v in cached.items() if k != "cache_key" and k != "created_at"})

    # Determine platform
    is_instagram = is_instagram_url(url)
    is_youtube = is_youtube_url(url)
    platform = "youtube" if is_youtube else "instagram"

    # Only enforce daily limit for non-cached (fresh) checks
    await verify_daily_limit(request, platform)

    pipeline_start = time.time()
    logger.info(f"Processing URL: {url} with language: {language_code} (platform: {platform})")

    try:
        if is_youtube:
            # --- YouTube pipeline: Gemini Flash (transcribe + fact-check in one shot) ---
            result = None

            # Primary: Gemini Flash
            if gemini_client:
                try:
                    step_gemini_start = time.time()
                    result = await fact_check_youtube_gemini(url, language_code)
                    step_gemini_dur = time.time() - step_gemini_start
                    logger.info(f"⏱ Steps 1-3 (Gemini Flash): {step_gemini_dur:.2f}s")
                except Exception as e:
                    logger.warning(f"Gemini pipeline failed, falling back to RapidAPI+Groq: {e}")

            # Fallback: RapidAPI → Groq Whisper → Groq Llama
            if result is None:
                video_id = extract_youtube_video_id(url)
                if not video_id:
                    raise HTTPException(
                        status_code=422,
                        detail={"error": "invalid_youtube_url", "message": "Could not extract video ID from the YouTube URL."}
                    )
                logger.info(f"Fallback: Processing YouTube video ID via RapidAPI: {video_id}")
                with tempfile.TemporaryDirectory() as temp_dir:
                    step1_start = time.time()
                    audio_path = await extract_audio_rapidapi(video_id, temp_dir)
                    step1_dur = time.time() - step1_start
                    logger.info(f"⏱ Step 1 - Audio extraction (RapidAPI fallback): {step1_dur:.2f}s")

                    step2_start = time.time()
                    transcript = await transcribe_audio(audio_path)
                    step2_dur = time.time() - step2_start
                    logger.info(f"⏱ Step 2 - Transcription (Groq Whisper): {step2_dur:.2f}s")

                    if not transcript or len(transcript.strip()) < 10:
                        raise HTTPException(
                            status_code=422,
                            detail={"error": "no_speech", "message": "Could not detect speech in this video."}
                        )

                    step3_start = time.time()
                    result = await fact_check_transcript(transcript, language_code)
                    step3_dur = time.time() - step3_start
                    logger.info(f"⏱ Step 3 - Fact-check (Groq Llama fallback): {step3_dur:.2f}s")

        elif is_instagram:
            # --- Instagram pipeline: RapidAPI → Groq Whisper → Groq Llama (unchanged) ---
            with tempfile.TemporaryDirectory() as temp_dir:
                step1_start = time.time()
                logger.info("Processing Instagram Reel...")
                normalized_url = extract_instagram_reel_url(url)
                audio_path = await extract_audio_instagram(normalized_url, temp_dir)
                step1_dur = time.time() - step1_start
                logger.info(f"⏱ Step 1 - Audio extraction (RapidAPI): {step1_dur:.2f}s")

                step2_start = time.time()
                logger.info("Transcribing audio...")
                transcript = await transcribe_audio(audio_path)
                step2_dur = time.time() - step2_start
                logger.info(f"⏱ Step 2 - Transcription (Groq Whisper): {step2_dur:.2f}s")

                if not transcript or len(transcript.strip()) < 10:
                    raise HTTPException(
                        status_code=422,
                        detail={"error": "no_speech", "message": "Could not detect speech in this video."}
                    )

                logger.info(f"Transcript: {transcript[:200]}...")

                step3_start = time.time()
                logger.info("Fact-checking...")
                result = await fact_check_transcript(transcript, language_code)
                step3_dur = time.time() - step3_start
                logger.info(f"⏱ Step 3 - Fact-check (Groq Llama): {step3_dur:.2f}s")
        else:
            raise HTTPException(
                status_code=422,
                detail={"error": "unsupported_platform", "message": "Only Instagram and YouTube are supported."}
            )

        # --- Shared: TTS + cache + usage logging ---
        step4_start = time.time()
        audio_text = result.get("verdict_text_regional") or result.get("verdict_text") or result.get("reason_regional") or result.get("reason", "")
        logger.info(f"Generating speech for {language_code}, text ({len(audio_text)} chars): {audio_text[:100]}...")
        audio_base64 = await synthesize_speech(audio_text, language_code) if audio_text.strip() else None
        step4_dur = time.time() - step4_start
        logger.info(f"⏱ Step 4 - TTS (Sarvam AI): {step4_dur:.2f}s")

        total_dur = time.time() - pipeline_start
        logger.info(f"⏱ TOTAL pipeline ({platform}): {total_dur:.2f}s")

        # Build response
        response = CheckResponse(
            claim=result["claim"],
            claim_regional=result.get("claim_regional", ""),
            verdict=result["verdict"],
            confidence=result["confidence"],
            reason=result["reason"],
            reason_regional=result.get("reason_regional", ""),
            verdict_text=result["verdict_text"],
            verdict_text_english=result.get("verdict_text_english", ""),
            verdict_text_regional=result.get("verdict_text_regional", ""),
            audio_base64=audio_base64,
            category=result.get("category", "general"),
            key_points=result.get("key_points", []),
            key_points_regional=result.get("key_points_regional", []),
            fact_details=result.get("fact_details", ""),
            fact_details_regional=result.get("fact_details_regional", ""),
            what_to_know=result.get("what_to_know", ""),
            what_to_know_regional=result.get("what_to_know_regional", ""),
            sources_note=result.get("sources_note", ""),
            why_misleading=result.get("why_misleading", ""),
            why_misleading_regional=result.get("why_misleading_regional", ""),
        )

        # Store in MongoDB cache
        cache_doc = response.model_dump()
        cache_doc["cache_key"] = cache_key
        cache_doc["url"] = url
        cache_doc["language_code"] = language_code
        cache_doc["created_at"] = datetime.now(timezone.utc).isoformat()
        await checks_collection.update_one(
            {"cache_key": cache_key},
            {"$set": cache_doc},
            upsert=True
        )

        # Log usage with platform tag, email, and result summary (for history)
        if device_id:
            device_doc = await devices_collection.find_one({"device_id": device_id})
            logged_email = None
            if device_doc:
                logged_email = (device_doc.get("google_email") or device_doc.get("admin_email") or "").lower() or None
            await usage_collection.insert_one({
                "device_id": device_id,
                "email": logged_email,
                "date_ist": today_ist(),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "url_checked": url,
                "language_code": language_code,
                "platform": platform,
                # History fields
                "claim": result.get("claim", ""),
                "verdict": result.get("verdict", ""),
                "confidence": result.get("confidence", 0),
            })

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Processing error: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "processing_error", "message": "An internal error occurred. Please try again later."}
        )

@api_router.get("/history")
async def get_history(request: Request, _: str = Depends(verify_api_key)):
    """Return the last 50 checks for this account. Login required."""
    device_id = request.headers.get("X-Device-Id", "")
    if not device_id:
        raise HTTPException(status_code=400, detail="Missing X-Device-Id header")

    device = await devices_collection.find_one({"device_id": device_id})
    is_auth = bool(device and (device.get("google_id") or device.get("admin_email")))
    if not is_auth:
        raise HTTPException(status_code=401, detail={"error": "auth_required", "message": "Sign in to view history."})

    email = (device.get("google_email") or device.get("admin_email") or "").lower()
    query = {"email": email, "claim": {"$exists": True, "$ne": ""}}

    cursor = usage_collection.find(query, {"_id": 0, "url_checked": 1, "platform": 1, "timestamp": 1, "claim": 1, "verdict": 1, "confidence": 1}).sort("timestamp", -1).limit(50)
    items = await cursor.to_list(length=50)
    return {"history": items}


# --- Admin: manually activate subscription for a Google account ---
@api_router.post("/admin/activate-subscription", dependencies=[Depends(verify_api_key)])
async def admin_activate_subscription(request: Request):
    """Manually activate a subscription for a given email.
    Protected by admin password + API key. Use only for payment support cases.
    """
    body = await request.json()
    admin_password = body.get("admin_password", "")
    email = (body.get("email") or "").strip().lower()
    razorpay_subscription_id = (body.get("razorpay_subscription_id") or "").strip()

    if not ADMIN_PASSWORD or admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Invalid admin password")
    if not email:
        raise HTTPException(status_code=400, detail="email is required")

    # Find google_id from devices collection
    device = await devices_collection.find_one({"google_email": email})
    if not device or not device.get("google_id"):
        raise HTTPException(status_code=404, detail=f"No authenticated device found for {email}")

    google_id = device["google_id"]
    now = datetime.now(timezone.utc).isoformat()

    await subscriptions_collection.update_one(
        {"google_id": google_id},
        {"$set": {
            "google_id": google_id,
            "google_email": email,
            "razorpay_subscription_id": razorpay_subscription_id or "manual_activation",
            "plan_id": RAZORPAY_PLAN_ID,
            "status": "active",
            "current_period_end": None,
            "created_at": now,
            "updated_at": now,
        }},
        upsert=True,
    )
    logger.info(f"Admin manually activated subscription for {email} (google_id={google_id})")
    return {"success": True, "message": f"Subscription activated for {email}", "google_id": google_id}


# --- Razorpay webhook (registered on main app to access raw request body) ---
@app.post("/api/webhooks/razorpay")
async def razorpay_webhook(request: Request):
    """Handle Razorpay subscription lifecycle events.
    Verifies HMAC-SHA256 signature before processing any event.
    """
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    logger.info(f"Razorpay webhook received: sig={'present' if signature else 'MISSING'} body_len={len(body)}")

    if not RAZORPAY_WEBHOOK_SECRET:
        logger.error("Razorpay webhook: RAZORPAY_WEBHOOK_SECRET not configured")
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    # Constant-time HMAC verification — prevents timing attacks
    expected = hmac_lib.new(
        RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
        body,
        "sha256",
    ).hexdigest()
    if not hmac_lib.compare_digest(expected, signature):
        logger.error(f"Razorpay webhook: INVALID signature. Expected={expected[:16]}... Got={signature[:16]}...")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        payload = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = payload.get("event", "")
    entity = payload.get("payload", {}).get("subscription", {}).get("entity", {})
    subscription_id = entity.get("id")
    notes = entity.get("notes", {})
    google_id = notes.get("google_id") if isinstance(notes, dict) else None
    email_from_notes = (notes.get("email") or "").strip().lower() if isinstance(notes, dict) else ""

    logger.info(f"Razorpay webhook event={event!r} subscription_id={subscription_id!r} google_id={google_id!r} email={email_from_notes!r}")

    if not subscription_id:
        logger.warning(f"Razorpay webhook: no subscription_id found in payload for event={event!r}")
        return {"status": "ok"}

    # If google_id is missing from notes (e.g. manually created subscription),
    # fall back to email lookup in devices collection
    if not google_id and email_from_notes:
        device = await devices_collection.find_one({"google_email": email_from_notes})
        if device and device.get("google_id"):
            google_id = device["google_id"]
            logger.info(f"Webhook: resolved google_id via email fallback for {email_from_notes}")

    now = datetime.now(timezone.utc).isoformat()

    if event in ("subscription.activated", "subscription.charged", "subscription.authenticated"):
        current_end = entity.get("current_end")
        period_end = datetime.fromtimestamp(current_end, tz=timezone.utc).isoformat() if current_end else None
        update: dict = {"status": "active", "current_period_end": period_end, "updated_at": now}
        if google_id:
            update["google_id"] = google_id
        if email_from_notes:
            update["google_email"] = email_from_notes
        # Try to update existing doc by subscription_id first
        matched = await subscriptions_collection.update_one(
            {"razorpay_subscription_id": subscription_id},
            {"$set": update},
        )
        if matched.matched_count > 0:
            logger.info(f"Webhook: updated existing doc by subscription_id={subscription_id}")
        else:
            if google_id:
                update["razorpay_subscription_id"] = subscription_id
                result = await subscriptions_collection.update_one(
                    {"google_id": google_id},
                    {"$set": update},
                    upsert=True,
                )
                logger.info(f"Webhook: upserted by google_id={google_id} matched={result.matched_count} upserted={result.upserted_id}")
            elif email_from_notes:
                update["razorpay_subscription_id"] = subscription_id
                result = await subscriptions_collection.update_one(
                    {"google_email": email_from_notes},
                    {"$set": update},
                    upsert=True,
                )
                logger.info(f"Webhook: upserted by email={email_from_notes} matched={result.matched_count} upserted={result.upserted_id}")
            else:
                logger.error(f"Webhook: cannot link subscription {subscription_id} — no google_id or email in notes")
        logger.info(f"Webhook processed: event={event} sub={subscription_id} status=active")

    elif event == "subscription.halted":
        await subscriptions_collection.update_one(
            {"razorpay_subscription_id": subscription_id},
            {"$set": {"status": "halted", "updated_at": now}},
        )
        logger.info(f"Subscription halted (payment failure): {subscription_id}")

    elif event in ("subscription.cancelled", "subscription.expired", "subscription.completed"):
        new_status = "cancelled" if event == "subscription.cancelled" else "expired"
        await subscriptions_collection.update_one(
            {"razorpay_subscription_id": subscription_id},
            {"$set": {"status": new_status, "updated_at": now}},
        )
        logger.info(f"Subscription ended ({event}): {subscription_id}")

    return {"status": "ok"}


# Include the router in the main app
app.include_router(api_router)

# CORS: permissive — mobile clients don't send Origin, web clients use API key auth
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key", "X-Device-Id"],
)

@app.on_event("startup")
async def startup_db():
    await checks_collection.create_index("cache_key", unique=True)
    await devices_collection.create_index("device_id", unique=True)
    await devices_collection.create_index("google_id", sparse=True)
    await usage_collection.create_index([("device_id", 1), ("date_ist", 1), ("platform", 1)])
    await subscriptions_collection.create_index("google_id", unique=True, sparse=True)
    await subscriptions_collection.create_index("razorpay_subscription_id", sparse=True)

@app.on_event("shutdown")
async def shutdown_db_client():
    global _http_client
    if _http_client and not _http_client.is_closed:
        await _http_client.aclose()
    client.close()
