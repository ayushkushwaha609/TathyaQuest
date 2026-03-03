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
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'tathya_db')]

# API Keys
GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
SARVAM_API_KEY = os.environ.get('SARVAM_API_KEY')
RAPIDAPI_KEY = os.environ.get('RAPIDAPI_KEY')

# Initialize Groq client
groq_client = Groq(api_key=GROQ_API_KEY)

# Create the main app
app = FastAPI(title="Tathya API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# MongoDB collection for caching
checks_collection = db["checks"]

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
        # Use instagram-reels-downloader-api (working API)
        try:
            logger.info("Trying instagram-reels-downloader-api...")
            response = await client.get(
                "https://instagram-reels-downloader-api.p.rapidapi.com/download",
                params={"url": url},
                headers={
                    "X-RapidAPI-Key": RAPIDAPI_KEY,
                    "X-RapidAPI-Host": "instagram-reels-downloader-api.p.rapidapi.com"
                },
                timeout=60.0
            )
            
            logger.info(f"instagram-reels-downloader-api response: {response.status_code}")
            
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
                    
                    # Download audio or video
                    download_url = audio_url or video_url
                    if download_url:
                        logger.info(f"Downloading media from: {download_url[:100]}...")
                        media_response = await client.get(download_url, follow_redirects=True, timeout=60.0)
                        
                        if media_response.status_code == 200 and len(media_response.content) > 1000:
                            if audio_url:
                                # Save as audio directly
                                audio_path = os.path.join(output_dir, "audio.m4a")
                                with open(audio_path, "wb") as f:
                                    f.write(media_response.content)
                                logger.info(f"Audio saved: {audio_path}, size: {len(media_response.content)} bytes")
                                return audio_path
                            else:
                                # Save video and extract audio
                                video_path = os.path.join(output_dir, "video.mp4")
                                audio_path = os.path.join(output_dir, "audio.mp3")
                                
                                with open(video_path, "wb") as f:
                                    f.write(media_response.content)
                                logger.info(f"Video saved: {video_path}, size: {len(media_response.content)} bytes")
                                
                                # Extract audio using ffmpeg
                                import subprocess
                                try:
                                    subprocess.run(
                                        ["ffmpeg", "-i", video_path, "-vn", "-acodec", "libmp3lame", "-q:a", "4", audio_path, "-y"],
                                        capture_output=True,
                                        timeout=30
                                    )
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
                    logger.warning(f"API error: {error_msg}")
                    
            elif response.status_code == 403:
                logger.warning("instagram-reels-downloader-api: Not subscribed (403)")
            else:
                logger.warning(f"instagram-reels-downloader-api: HTTP {response.status_code} - {response.text[:200]}")
                
        except Exception as e:
            logger.warning(f"instagram-reels-downloader-api failed: {e}")
        
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
                "https://youtube-mp310.p.rapidapi.com/download/mp3",
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
                "https://youtube-mp3-2025.p.rapidapi.com/download",
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
                    "https://youtube-mp36.p.rapidapi.com/dl",
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
                        logger.info("Downloading MP3 from mp36...")
                        
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
    
    system_prompt = """You are an expert fact-checker with broad knowledge across topics including science, history, current affairs, technology, health, finance, and general knowledge. 

IMPORTANT RULES:
1. You ONLY fact-check claims that are EXPLICITLY stated in the video transcript. Do NOT infer or assume claims.
2. Be OBJECTIVE - stick to verifiable facts, not opinions or interpretations.
3. Your confidence score should reflect how certain you are about the factual accuracy, using precise numbers (e.g., 73, 87, 91) - NOT round numbers like 50, 60, 70.
4. If something is MISLEADING, you MUST explain exactly WHY it is misleading and what the correct information is.
5. Provide thorough, educational explanations that help users understand the truth.

Always return ONLY valid JSON. No explanation outside the JSON object."""

    user_prompt = f"""
Video transcript (this is EXACTLY what was said in the video):
\"\"\"
{transcript}
\"\"\"

TASK: Fact-check ONLY the specific claims made in this transcript. Do not evaluate opinions, predictions, or subjective statements - only verifiable factual claims.

IMPORTANT: Provide ALL content in BOTH English AND {language_name}. Keep responses CONCISE to fit within limits.

Return ONLY this JSON with no other text:
{{
  "claim": "One clear sentence summarizing the main claim (English)",
  "claim_{lang_key}": "Same claim in {language_name}",
  "verdict": "TRUE" or "FALSE" or "MISLEADING" or "PARTIALLY_TRUE",
  "confidence": integer 0-100 (use specific numbers like 73, 84, 91),
  "category": "health" or "science" or "history" or "technology" or "finance" or "news" or "general",
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
}}
"""

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.2,  # Lower temperature for more consistent, factual responses
        max_tokens=4000,  # Increased for bilingual responses with longer scripts
    )
    
    response_text = response.choices[0].message.content.strip()
    
    # Parse JSON from response
    try:
        # Try to extract JSON if wrapped in markdown code blocks
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        # Try to repair truncated JSON
        if not response_text.rstrip().endswith("}"):
            logger.warning("JSON appears truncated, attempting repair...")
            # Count open braces and brackets
            open_braces = response_text.count('{') - response_text.count('}')
            open_brackets = response_text.count('[') - response_text.count(']')
            
            # Check if we're in the middle of a string
            # Count unescaped quotes
            in_string = False
            for i, char in enumerate(response_text):
                if char == '"' and (i == 0 or response_text[i-1] != '\\'):
                    in_string = not in_string
            
            if in_string:
                # We're in the middle of a string, close it
                response_text += '"'
            
            # Close any open brackets
            response_text += ']' * open_brackets
            # Close any open braces
            response_text += '}' * open_braces
            
            logger.info("Repaired truncated JSON response")
        
        result = json.loads(response_text)
        
        # Get the verdict texts
        verdict_key = f"verdict_{lang_key}"
        verdict_text_english = result.get("verdict_english", result.get("reason", ""))
        verdict_text_regional = result.get(verdict_key, result.get("reason", ""))
        
        # Combine both for display (English first, then regional language)
        combined_verdict_text = f"{verdict_text_english}\n\n{verdict_text_regional}"
        
        # Ensure confidence is not a round number (add some variation if it is)
        confidence = result.get("confidence", 50)
        if confidence % 10 == 0 and confidence > 0 and confidence < 100:
            import random
            # Add small random variation to make it more realistic
            confidence = confidence + random.choice([-3, -2, -1, 1, 2, 3])
            confidence = max(1, min(99, confidence))  # Keep within bounds
        
        # Get bilingual fields
        claim_regional_key = f"claim_{lang_key}"
        reason_regional_key = f"reason_{lang_key}"
        key_points_regional_key = f"key_points_{lang_key}"
        fact_details_regional_key = f"fact_details_{lang_key}"
        what_to_know_regional_key = f"what_to_know_{lang_key}"
        why_misleading_regional_key = f"why_misleading_{lang_key}"
        
        return {
            "claim": result.get("claim", "Could not identify claim"),
            "claim_regional": result.get(claim_regional_key, ""),
            "verdict": result.get("verdict", "MISLEADING"),
            "confidence": confidence,
            "reason": result.get("reason", "Analysis inconclusive"),
            "reason_regional": result.get(reason_regional_key, ""),
            "verdict_text": combined_verdict_text,
            "verdict_text_english": verdict_text_english,
            "verdict_text_regional": verdict_text_regional,
            "category": result.get("category", "general"),
            "key_points": result.get("key_points", []),
            "key_points_regional": result.get(key_points_regional_key, []),
            "fact_details": result.get("fact_details", ""),
            "fact_details_regional": result.get(fact_details_regional_key, ""),
            "what_to_know": result.get("what_to_know", ""),
            "what_to_know_regional": result.get(what_to_know_regional_key, ""),
            "sources_note": result.get("sources_note", ""),
            "why_misleading": result.get("why_misleading", ""),
            "why_misleading_regional": result.get(why_misleading_regional_key, "")
        }
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}, Response: {response_text[:500]}...")
        
        # Get the appropriate error message in regional language
        error_messages = {
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
    
    # Validate language code
    if language_code not in LANGUAGE_MAP:
        language_code = "hi-IN"  # Default to Hindi
    
    # Check MongoDB cache
    cache_key = get_cache_key(url, language_code)
    cached = await checks_collection.find_one({"cache_key": cache_key}, {"_id": 0})
    if cached:
        logger.info(f"MongoDB cache hit for {cache_key}")
        return CheckResponse(**{k: v for k, v in cached.items() if k != "cache_key" and k != "created_at"})
    
    logger.info(f"Processing URL: {url} with language: {language_code}")
    
    # Determine platform and extract accordingly
    is_instagram = is_instagram_url(url)
    is_youtube = is_youtube_url(url)
    
    # Create temp directory for audio
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            # Step 1: Extract audio based on platform
            if is_instagram:
                logger.info("Processing Instagram Reel...")
                normalized_url = extract_instagram_reel_url(url)
                audio_path = await extract_audio_instagram(normalized_url, temp_dir)
            elif is_youtube:
                video_id = extract_youtube_video_id(url)
                if not video_id:
                    raise HTTPException(
                        status_code=422,
                        detail={"error": "invalid_youtube_url", "message": "Could not extract video ID from the YouTube URL."}
                    )
                logger.info(f"Processing YouTube video ID: {video_id}")
                audio_path = await extract_audio_rapidapi(video_id, temp_dir)
            else:
                raise HTTPException(
                    status_code=422,
                    detail={"error": "unsupported_platform", "message": "Only Instagram and YouTube are supported."}
                )
            
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
            
            # Step 4: Generate TTS with the more elaborate regional language text
            logger.info("Generating speech...")
            # Use the regional language verdict for TTS (more elaborate version)
            audio_text = result.get("verdict_text_regional", result["verdict_text"])
            audio_base64 = await synthesize_speech(audio_text, language_code)
            
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
            await checks_collection.insert_one(cache_doc)
            
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

@app.on_event("startup")
async def startup_db():
    await checks_collection.create_index("cache_key", unique=True)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
