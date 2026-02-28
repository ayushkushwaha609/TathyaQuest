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
from urllib.parse import quote as url_quote

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'sachcheck_db')]

# API Keys
GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
SARVAM_API_KEY = os.environ.get('SARVAM_API_KEY')
RAPIDAPI_KEY = os.environ.get('RAPIDAPI_KEY')

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
    """Extract audio from Instagram Reel using RapidAPI"""
    logger.info(f"Fetching Instagram Reel via RapidAPI: {url}")
    
    async with httpx.AsyncClient(timeout=90.0) as client:
        # Try instagram-reels-downloader6 API
        logger.info("Trying instagram-reels-downloader6 API...")
        try:
            response = await client.get(
                "https://instagram-reels-downloader6.p.rapidapi.com/download",
                params={"url": url},
                headers={
                    "X-RapidAPI-Key": RAPIDAPI_KEY,
                    "X-RapidAPI-Host": "instagram-reels-downloader6.p.rapidapi.com"
                },
                timeout=60.0
            )
            
            logger.info(f"instagram-reels-downloader6 response: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Instagram API response: {data}")
                
                # Try to get video URL from response
                video_url = None
                if isinstance(data, dict):
                    video_url = data.get("video_url") or data.get("url") or data.get("download_url") or data.get("media")
                    if not video_url and "data" in data:
                        video_url = data["data"].get("video_url") or data["data"].get("url")
                
                if video_url and video_url.startswith("http"):
                    # Download the video file
                    logger.info(f"Downloading Instagram video from: {video_url[:100]}...")
                    video_response = await client.get(video_url, follow_redirects=True, timeout=60.0)
                    
                    if video_response.status_code == 200 and len(video_response.content) > 1000:
                        # Save as video first, then extract audio with ffmpeg
                        video_path = os.path.join(output_dir, "video.mp4")
                        audio_path = os.path.join(output_dir, "audio.mp3")
                        
                        with open(video_path, "wb") as f:
                            f.write(video_response.content)
                        logger.info(f"Video saved: {video_path}, size: {len(video_response.content)} bytes")
                        
                        # Extract audio using ffmpeg
                        import subprocess
                        try:
                            result = subprocess.run(
                                ["ffmpeg", "-i", video_path, "-vn", "-acodec", "libmp3lame", "-q:a", "4", audio_path, "-y"],
                                capture_output=True,
                                timeout=30
                            )
                            if os.path.exists(audio_path) and os.path.getsize(audio_path) > 1000:
                                logger.info(f"Audio extracted: {audio_path}")
                                return audio_path
                            else:
                                logger.warning(f"FFmpeg extraction failed: {result.stderr.decode()[:200]}")
                        except Exception as e:
                            logger.warning(f"FFmpeg error: {e}")
                            # If ffmpeg fails, try using the video file directly for transcription
                            return video_path
                    else:
                        logger.warning(f"Failed to download Instagram video: {video_response.status_code}")
                else:
                    logger.warning(f"No valid video URL in response: {data}")
                    
        except Exception as e:
            logger.warning(f"instagram-reels-downloader6 failed: {e}")
        
        # Try alternative API: instagram-reels-downloader2
        logger.info("Trying instagram-reels-downloader2 API...")
        try:
            response = await client.get(
                "https://instagram-reels-downloader2.p.rapidapi.com/reels",
                params={"url": url},
                headers={
                    "X-RapidAPI-Key": RAPIDAPI_KEY,
                    "X-RapidAPI-Host": "instagram-reels-downloader2.p.rapidapi.com"
                },
                timeout=60.0
            )
            
            logger.info(f"instagram-reels-downloader2 response: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Instagram API2 response: {data}")
                
                video_url = None
                if isinstance(data, dict):
                    video_url = data.get("video") or data.get("video_url") or data.get("url")
                    if not video_url and "result" in data:
                        video_url = data["result"].get("video") or data["result"].get("url")
                
                if video_url and video_url.startswith("http"):
                    logger.info(f"Downloading from API2: {video_url[:100]}...")
                    video_response = await client.get(video_url, follow_redirects=True, timeout=60.0)
                    
                    if video_response.status_code == 200 and len(video_response.content) > 1000:
                        video_path = os.path.join(output_dir, "video.mp4")
                        audio_path = os.path.join(output_dir, "audio.mp3")
                        
                        with open(video_path, "wb") as f:
                            f.write(video_response.content)
                        
                        # Extract audio using ffmpeg
                        import subprocess
                        try:
                            subprocess.run(
                                ["ffmpeg", "-i", video_path, "-vn", "-acodec", "libmp3lame", "-q:a", "4", audio_path, "-y"],
                                capture_output=True,
                                timeout=30
                            )
                            if os.path.exists(audio_path) and os.path.getsize(audio_path) > 1000:
                                return audio_path
                        except Exception as e:
                            logger.warning(f"FFmpeg error: {e}")
                            return video_path
                            
        except Exception as e:
            logger.warning(f"instagram-reels-downloader2 failed: {e}")
        
        raise Exception("Could not download Instagram Reel. Please make sure the reel is public and try again.")

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

async def extract_audio_rapidapi(video_id: str, output_dir: str) -> str:
    """Extract audio from YouTube using RapidAPI"""
    logger.info(f"Fetching audio via RapidAPI for video ID: {video_id}")
    
    # Construct full YouTube URL
    youtube_url = f"https://www.youtube.com/watch?v={video_id}"
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        # Try youtube-mp310 API first (returns direct link as text)
        logger.info("Trying youtube-mp310 API...")
        try:
            response = await client.get(
                f"https://youtube-mp310.p.rapidapi.com/download/mp3",
                params={"url": youtube_url},
                headers={
                    "X-RapidAPI-Key": RAPIDAPI_KEY,
                    "X-RapidAPI-Host": "youtube-mp310.p.rapidapi.com"
                },
                timeout=60.0
            )
            
            logger.info(f"youtube-mp310 response status: {response.status_code}, body: {response.text[:200]}")
            
            if response.status_code == 200:
                mp3_url = response.text.strip()
                
                if mp3_url and mp3_url.startswith("http"):
                    # Download the MP3 file
                    logger.info(f"Downloading MP3 from mp310: {mp3_url[:100]}...")
                    mp3_response = await client.get(mp3_url, follow_redirects=True, timeout=60.0)
                    if mp3_response.status_code == 200 and len(mp3_response.content) > 1000:
                        output_path = os.path.join(output_dir, "audio.mp3")
                        with open(output_path, "wb") as f:
                            f.write(mp3_response.content)
                        logger.info(f"Audio saved from mp310: {output_path}, size: {len(mp3_response.content)} bytes")
                        return output_path
                    else:
                        logger.warning(f"Failed to download MP3 from mp310: status={mp3_response.status_code}, size={len(mp3_response.content)}")
                else:
                    logger.warning(f"Invalid MP3 URL from mp310: {mp3_url[:100]}")
                    
        except Exception as e:
            logger.warning(f"youtube-mp310 API failed: {e}")
        
        # Try youtube-mp3-2025 API
        logger.info("Trying youtube-mp3-2025 API...")
        try:
            response = await client.get(
                f"https://youtube-mp3-2025.p.rapidapi.com/download",
                params={"id": video_id},
                headers={
                    "X-RapidAPI-Key": RAPIDAPI_KEY,
                    "X-RapidAPI-Host": "youtube-mp3-2025.p.rapidapi.com"
                },
                timeout=60.0
            )
            
            logger.info(f"youtube-mp3-2025 response: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"youtube-mp3-2025 data: {data}")
                
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
            logger.warning(f"youtube-mp3-2025 API failed: {e}")
        
        # Fallback to youtube-mp36 API with retry logic
        logger.info("Trying youtube-mp36 API as fallback...")
        max_retries = 5
        retry_delay = 5
        
        for attempt in range(max_retries):
            try:
                response = await client.get(
                    f"https://youtube-mp36.p.rapidapi.com/dl",
                    params={"id": video_id},
                    headers={
                        "X-RapidAPI-Key": RAPIDAPI_KEY,
                        "X-RapidAPI-Host": "youtube-mp36.p.rapidapi.com"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"youtube-mp36 response (attempt {attempt + 1}): status={data.get('status')}")
                    
                    status = data.get("status", "").lower()
                    
                    if status == "ok" and data.get("link"):
                        mp3_url = data["link"]
                        logger.info(f"Downloading MP3 from mp36...")
                        
                        # Try to download with headers
                        mp3_response = await client.get(
                            mp3_url, 
                            follow_redirects=True, 
                            timeout=60.0,
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
                        else:
                            logger.warning(f"mp36 download failed: status={mp3_response.status_code}")
                    
                    elif status in ["processing", "in process"]:
                        logger.info(f"Video processing, waiting {retry_delay}s...")
                        import asyncio
                        await asyncio.sleep(retry_delay)
                        continue
                    
            except Exception as e:
                logger.warning(f"youtube-mp36 attempt {attempt + 1} failed: {e}")
            
            import asyncio
            await asyncio.sleep(retry_delay)
        
        raise Exception("Could not extract audio. Please try a different video.")

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
                    "speaker": "anushka",  # Compatible speaker for bulbul:v2
                    "model": "bulbul:v2",  # Stable model version
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
    
    # Check if it's Instagram (not supported via RapidAPI yet)
    if is_instagram_url(url):
        raise HTTPException(
            status_code=422,
            detail={"error": "instagram_not_supported", "message": "Instagram reels are not supported yet. Please try a YouTube Shorts link instead."}
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
    
    # Extract video ID for YouTube
    video_id = extract_youtube_video_id(url)
    if not video_id:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_youtube_url", "message": "Could not extract video ID from the YouTube URL."}
        )
    
    logger.info(f"Extracted video ID: {video_id}")
    
    # Create temp directory for audio
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            # Step 1: Extract audio via RapidAPI
            logger.info("Extracting audio via RapidAPI...")
            audio_path = await extract_audio_rapidapi(video_id, temp_dir)
            
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
