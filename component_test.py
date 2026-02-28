#!/usr/bin/env python3
"""
Test individual components of the SachCheck backend
"""

import os
import asyncio
import sys
import tempfile
from pathlib import Path

# Add backend to path
sys.path.append('/app/backend')

# Import after adding to path
from groq import Groq
import httpx
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path('/app/backend')
load_dotenv(ROOT_DIR / '.env')

GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
SARVAM_API_KEY = os.environ.get('SARVAM_API_KEY')

def test_groq_llama_api():
    """Test Groq Llama API connection"""
    print("🔍 Testing Groq Llama API...")
    try:
        groq_client = Groq(api_key=GROQ_API_KEY)
        
        system_prompt = """You are an expert health and nutrition fact-checker. Always return ONLY valid JSON. No explanation outside the JSON object."""
        
        user_prompt = """
Video transcript:
\"\"\"
Eating apples daily is very healthy for you. Apples contain fiber and vitamins.
\"\"\"

Analyze the main health or food claim made in this video.

Return ONLY this JSON with no other text:
{
  "claim": "one sentence summary of the main claim",
  "verdict": "TRUE" or "FALSE" or "MISLEADING" or "PARTIALLY_TRUE",
  "confidence": integer between 0 and 100,
  "reason": "2-3 sentences max explaining your verdict in simple language",
  "verdict_hindi": "The verdict as a natural spoken sentence in Hindi. Start with the verdict word, then reason briefly. Max 2 sentences."
}
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
        print(f"✅ Groq Llama API: WORKING")
        print(f"   Response preview: {response_text[:100]}...")
        return True
        
    except Exception as e:
        print(f"❌ Groq Llama API: FAILED")
        print(f"   Error: {str(e)}")
        return False

async def test_sarvam_tts_api():
    """Test Sarvam TTS API connection"""
    print("🔍 Testing Sarvam TTS API...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.sarvam.ai/text-to-speech",
                headers={"API-Subscription-Key": SARVAM_API_KEY},
                json={
                    "inputs": ["यह एक टेस्ट है"],
                    "target_language_code": "hi-IN",
                    "speaker": "priya",
                    "model": "bulbul:v3",
                    "pace": 1.0,
                    "enable_preprocessing": True
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                audio_data = data.get("audios", [None])[0]
                print(f"✅ Sarvam TTS API: WORKING")
                print(f"   Audio generated: {'Yes' if audio_data else 'No'}")
                return True
            else:
                print(f"❌ Sarvam TTS API: FAILED")
                print(f"   Status: {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Sarvam TTS API: FAILED")
        print(f"   Error: {str(e)}")
        return False

def test_groq_whisper_api():
    """Test Groq Whisper API with a dummy audio file"""
    print("🔍 Testing Groq Whisper API...")
    try:
        groq_client = Groq(api_key=GROQ_API_KEY)
        
        # Create a minimal audio file for testing (this will fail but show API connectivity)
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as temp_audio:
            # Write minimal MP3 header (will be invalid but tests API call format)
            temp_audio.write(b'ID3\x04\x00\x00\x00\x00\x00\x00')
            temp_audio_path = temp_audio.name
        
        try:
            with open(temp_audio_path, "rb") as audio_file:
                transcription = groq_client.audio.transcriptions.create(
                    file=(os.path.basename(temp_audio_path), audio_file.read()),
                    model="whisper-large-v3",
                    response_format="text",
                )
            print(f"✅ Groq Whisper API: WORKING")
            print(f"   Transcription: {transcription}")
            return True
        except Exception as api_error:
            # If it's an invalid audio format error, that means API is accessible
            if "invalid" in str(api_error).lower() or "format" in str(api_error).lower():
                print(f"✅ Groq Whisper API: WORKING (API accessible)")
                print(f"   Note: Test file format invalid (expected)")
                return True
            else:
                raise api_error
        finally:
            # Clean up
            if os.path.exists(temp_audio_path):
                os.unlink(temp_audio_path)
                
    except Exception as e:
        print(f"❌ Groq Whisper API: FAILED")
        print(f"   Error: {str(e)}")
        return False

async def main():
    """Run all component tests"""
    print("=" * 60)
    print("🧪 SachCheck Component Test Suite")
    print("=" * 60)
    
    results = {}
    
    # Test individual APIs
    results["groq_llama"] = test_groq_llama_api()
    results["groq_whisper"] = test_groq_whisper_api()
    results["sarvam_tts"] = await test_sarvam_tts_api()
    
    print()
    print("=" * 60)
    print("📊 COMPONENT TEST SUMMARY")
    print("=" * 60)
    
    for test_name, result in results.items():
        status = "✅ WORKING" if result else "❌ FAILED"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    working_count = sum(1 for result in results.values() if result)
    total_count = len(results)
    
    print()
    print(f"Results: {working_count}/{total_count} components working")
    
    if working_count == total_count:
        print("🎉 All API integrations are working!")
    else:
        print("⚠️ Some API integrations failed.")
    
    return working_count == total_count

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)