"""
Load test for Tathya API using Locust.

Usage:
  1. pip install locust
  2. locust -f tests/locustfile.py --host https://YOUR-DEPLOYED-URL
  3. Open http://localhost:8089 in browser
  4. Set users=100, spawn rate=10, and start

This simulates real users hitting /api/check with YouTube/Instagram URLs.
Cached responses will be fast; the test reveals how the server handles
concurrent pipeline executions (audio extract → transcribe → fact-check → TTS).
"""

from locust import HttpUser, task, between


# Sample URLs to test with (mix of YouTube and Instagram)
TEST_URLS = [
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
]

LANGUAGES = ["hi-IN", "ta-IN", "te-IN", "kn-IN", "mr-IN", "bn-IN"]


class FactCheckUser(HttpUser):
    """Simulates a user submitting URLs for fact-checking."""

    # Wait 2-5 seconds between requests (realistic user behavior)
    wait_time = between(2, 5)

    @task(1)
    def health_check(self):
        """Lightweight health probe (baseline latency)."""
        self.client.get("/api/health")

    @task(3)
    def check_video(self):
        """Submit a video URL for fact-checking."""
        import random

        url = random.choice(TEST_URLS)
        lang = random.choice(LANGUAGES)

        with self.client.post(
            "/api/check",
            json={"url": url, "language_code": lang},
            timeout=120,
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 429:
                # Rate-limited — expected under heavy load
                resp.success()
            else:
                resp.failure(f"HTTP {resp.status_code}: {resp.text[:200]}")
