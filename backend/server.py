from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional
import hashlib
import tempfile
import json
import re
import httpx
from groq import Groq
import yt_dlp

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'sachcheck_db')]

# API Keys
GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
SARVAM_API_KEY = os.environ.get('SARVAM_API_KEY')

# Initialize Groq client
groq_client = Groq(api_key=GROQ_API_KEY)

# Create the main app
app = FastAPI(title="SachCheck API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# In-memory cache for MVP
cache = {}

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Language mapping
LANGUAGE_MAP = {
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
    url: str
    language_code: str = "hi-IN"

class CheckResponse(BaseModel):
    claim: str
    verdict: str
    confidence: int
    reason: str
    verdict_text: str
    audio_base64: Optional[str] = None

class ErrorResponse(BaseModel):
    error: str
    message: str

# Helper Functions
def get_cache_key(url: str, language_code: str) -> str:
    return hashlib.md5(f"{url}:{language_code}".encode()).hexdigest()

def validate_url(url: str) -> bool:
    """Validate if URL is from Instagram or YouTube"""
    patterns = [
        r'(instagram\.com|instagr\.am)',
        r'(youtube\.com|youtu\.be)',
    ]
    return any(re.search(pattern, url) for pattern in patterns)

def extract_audio(url: str, output_dir: str) -> str:
    """Extract audio from video URL using yt-dlp"""
    output_path = os.path.join(output_dir, 'audio')
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_path,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '64',
        }],
        'max_filesize': 25 * 1024 * 1024,
        'socket_timeout': 30,
        'quiet': True,
        'no_warnings': True,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            duration = info.get('duration', 0)
            if duration > 300:  # 5 minutes max
                raise ValueError("Video too long (max 5 minutes)")
    except Exception as e:
        logger.error(f"yt-dlp error: {e}")
        raise
    
    return output_path + ".mp3"

def transcribe_audio(audio_path: str) -> str:
    """Transcribe audio using Groq Whisper"""
    with open(audio_path, "rb") as audio_file:
        transcription = groq_client.audio.transcriptions.create(
            file=(os.path.basename(audio_path), audio_file.read()),
            model="whisper-large-v3",
            response_format="text",
        )
    return transcription

def fact_check_transcript(transcript: str, language_code: str) -> dict:
    """Fact-check the transcript using Groq Llama"""
    # Truncate transcript to ~1500 tokens
    transcript = transcript[:6000]
    
    lang_key, language_name = LANGUAGE_MAP.get(language_code, ("hindi", "Hindi"))
    
    system_prompt = """You are an expert health and nutrition fact-checker with deep knowledge of Indian dietary practices and medical science. You are concise and precise.

Always return ONLY valid JSON. No explanation outside the JSON object."""

    user_prompt = f"""
Video transcript:
\"\"\"
{transcript}
\"\"\"

Analyze the main health or food claim made in this video.

Return ONLY this JSON with no other text:
{{
  "claim": "one sentence summary of the main claim",
  "verdict": "TRUE" or "FALSE" or "MISLEADING" or "PARTIALLY_TRUE",
  "confidence": integer between 0 and 100,
  "reason": "2-3 sentences max explaining your verdict in simple language",
  "verdict_{lang_key}": "The verdict as a natural spoken sentence in {language_name}. Start with the verdict word, then reason briefly. Max 2 sentences."
}}
"""

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.3,
        max_tokens=1000,
    )
    
    response_text = response.choices[0].message.content.strip()
    
    # Parse JSON from response
    try:
        # Try to extract JSON if wrapped in markdown code blocks
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        result = json.loads(response_text)
        
        # Get the verdict text in the requested language
        verdict_key = f"verdict_{lang_key}"
        verdict_text = result.get(verdict_key, result.get("reason", ""))
        
        return {
            "claim": result.get("claim", "Could not identify claim"),
            "verdict": result.get("verdict", "MISLEADING"),
            "confidence": result.get("confidence", 50),
            "reason": result.get("reason", "Analysis inconclusive"),
            "verdict_text": verdict_text
        }
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}, Response: {response_text}")
        return {
            "claim": "Could not parse response",
            "verdict": "MISLEADING",
            "confidence": 0,
            "reason": "Failed to analyze the content",
            "verdict_text": "Analysis failed"
        }

async def synthesize_speech(text: str, language_code: str) -> Optional[str]:
    """Convert text to speech using Sarvam AI TTS"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.sarvam.ai/text-to-speech",
                headers={"API-Subscription-Key": SARVAM_API_KEY},
                json={
                    "inputs": [text],
                    "target_language_code": language_code,
                    "speaker": "meera",
                    "model": "bulbul:v1",
                    "pace": 1.0,
                    "enable_preprocessing": True
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get("audios", [None])[0]
            else:
                logger.error(f"Sarvam TTS error: {response.status_code} - {response.text}")
                return None
    except Exception as e:
        logger.error(f"Sarvam TTS exception: {e}")
        return None

# API Endpoints
@api_router.get("/health")
async def health_check():
    return {"status": "ok"}

@api_router.post("/check", response_model=CheckResponse)
async def check_claim(request: CheckRequest):
    """Main endpoint - fact-check a video URL"""
    url = request.url.strip()
    language_code = request.language_code
    
    # Validate URL
    if not validate_url(url):
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_url", "message": "Please provide a valid Instagram or YouTube link."}
        )
    
    # Validate language code
    if language_code not in LANGUAGE_MAP:
        language_code = "hi-IN"  # Default to Hindi
    
    # Check cache
    cache_key = get_cache_key(url, language_code)
    if cache_key in cache:
        logger.info(f"Cache hit for {cache_key}")
        return cache[cache_key]
    
    logger.info(f"Processing URL: {url} with language: {language_code}")
    
    # Create temp directory for audio
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            # Step 1: Extract audio
            logger.info("Extracting audio...")
            audio_path = extract_audio(url, temp_dir)
            
            # Step 2: Transcribe
            logger.info("Transcribing audio...")
            transcript = transcribe_audio(audio_path)
            
            if not transcript or len(transcript.strip()) < 10:
                raise HTTPException(
                    status_code=422,
                    detail={"error": "no_speech", "message": "Could not detect speech in this video."}
                )
            
            logger.info(f"Transcript: {transcript[:200]}...")
            
            # Step 3: Fact-check
            logger.info("Fact-checking...")
            result = fact_check_transcript(transcript, language_code)
            
            # Step 4: Generate TTS
            logger.info("Generating speech...")
            audio_base64 = await synthesize_speech(result["verdict_text"], language_code)
            
            # Build response
            response = CheckResponse(
                claim=result["claim"],
                verdict=result["verdict"],
                confidence=result["confidence"],
                reason=result["reason"],
                verdict_text=result["verdict_text"],
                audio_base64=audio_base64
            )
            
            # Store in cache
            cache[cache_key] = response
            
            return response
            
        except HTTPException:
            raise
        except yt_dlp.utils.DownloadError as e:
            logger.error(f"Download error: {e}")
            raise HTTPException(
                status_code=422,
                detail={"error": "could_not_fetch", "message": "Could not extract audio from this link. The reel may be private or unavailable."}
            )
        except Exception as e:
            logger.error(f"Processing error: {e}")
            raise HTTPException(
                status_code=500,
                detail={"error": "processing_error", "message": f"An error occurred while processing: {str(e)}"}
            )

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
