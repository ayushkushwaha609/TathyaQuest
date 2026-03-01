# Tathya — Complete Project Handoff Summary

## App Name: **Tathya** (तथ्य — meaning "fact" in Hindi)

## What is this app?
Tathya is a mobile-first fact-checking app. You paste an Instagram Reel or YouTube Short URL (or share it directly from those apps), and it:
1. Extracts the audio from the video
2. Transcribes it using AI
3. Fact-checks the claims using an LLM
4. Generates a Text-to-Speech verdict in your chosen Indian language

---

## GitHub Repo
**https://github.com/ayushkushwaha609/SachCheck.git** (repo name is SachCheck but app is renamed to Tathya everywhere in code)

---

## Tech Stack
| Component | Technology |
|-----------|-----------|
| **Frontend** | Expo (React Native) + TypeScript + Zustand + Expo Router |
| **Backend** | Python FastAPI + Pydantic |
| **Database** | MongoDB (persistent caching of results) |
| **Audio Extraction** | RapidAPI (youtube-mp36 + instagram-reels-downloader-api) |
| **Transcription** | Groq Whisper API |
| **Fact-Checking** | Groq Llama 3.3 70B |
| **Text-to-Speech** | Sarvam AI bulbul:v2 model |

---

## API Keys (all stored in `backend/.env`)
```
GROQ_API_KEY=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
SARVAM_API_KEY=sk_zluof264_YjnN1nb17u6CWfx9gzCcFIil
RAPIDAPI_KEY=3039a462c5msh848800efd267facp13167ejsn8fc0d6459227
```
- The RAPIDAPI_KEY must be subscribed to `youtube-mp36` and `instagram-reels-downloader-api` on RapidAPI.
- MongoDB Atlas connection string for production: `mongodb+srv://ayushkushwaha:Getshitdone%40123@cluster0.zewgcob.mongodb.net/tathya_db?appName=Cluster0`

---

## Deployment (All Free Tier)

### Backend — Render
- **URL**: https://tathya-api.onrender.com
- **Runtime**: Docker (uses `backend/Dockerfile`)
- **Root Directory**: `backend`
- Has a `render.yaml` blueprint and `requirements.deploy.txt` for slim dependencies
- Uses `motor==3.5.1` + `pymongo==4.8.0` (pinned for compatibility — newer pymongo breaks motor)
- **Free tier note**: Sleeps after 15 min inactivity, ~30s cold start on first request

### Frontend (Web) — Cloudflare Pages
- Deploy from GitHub, root directory `frontend`
- Build command: `npx expo export --platform web`
- Output directory: `dist`
- Env var: `EXPO_PUBLIC_BACKEND_URL=https://tathya-api.onrender.com`

### Database — MongoDB Atlas
- Free M0 cluster on `cluster0.zewgcob.mongodb.net`
- DB name: `tathya_db`
- Collection: `checks` (indexed on `cache_key`, unique)

### Android APK — EAS Build
- `eas.json` is configured with the Render URL baked in
- Build command: `npx eas-cli build --platform android --profile preview`
- Use `npm install --legacy-peer-deps` when installing dependencies locally

---

## Code Architecture
```
/app
├── backend/
│   ├── server.py              # All API logic (extraction, transcription, fact-check, TTS, caching)
│   ├── .env                   # API keys
│   ├── Dockerfile             # For Render deployment
│   ├── render.yaml            # Render blueprint
│   ├── requirements.txt       # Full dependencies (dev)
│   └── requirements.deploy.txt # Slim dependencies (production)
├── frontend/
│   ├── app/
│   │   ├── _layout.tsx        # Root layout (dark theme)
│   │   ├── index.tsx          # Home screen (URL input + language picker + share intent handler)
│   │   └── result.tsx         # Result screen (verdict + audio player)
│   ├── components/
│   │   ├── VerdictCard.tsx    # Displays verdict with enhanced context fields
│   │   ├── LanguagePicker.tsx # Language selection (8 Indian languages)
│   │   └── LoadingOverlay.tsx # Loading animation
│   ├── store/
│   │   └── useCheckStore.ts   # Zustand state (API calls, results, with Render URL fallback)
│   ├── constants/
│   │   └── languages.ts       # Language codes and names
│   ├── plugins/
│   │   └── withShareIntent.js # Custom Expo config plugin for Android share intent
│   ├── app.json               # Expo config
│   ├── eas.json               # EAS Build config with production backend URL
│   └── .env                   # Preview environment URL
├── DEPLOY.md                  # Full deployment guide
└── memory/
    └── PRD.md                 # Product requirements document
```

---

## Key API Endpoints
- `GET /api/health` → `{"status": "ok"}`
- `POST /api/check` → Main endpoint. Body: `{"url": "...", "language_code": "hi-IN"}`
  - Returns: `claim`, `verdict`, `confidence`, `reason`, `verdict_text`, `audio_base64`, `category`, `key_points`, `fact_details`, `what_to_know`, `sources_note`

---

## MongoDB Schema (Collection: `checks`)
```json
{
  "cache_key": "md5(url:language_code)",
  "url": "https://...",
  "language_code": "hi-IN",
  "claim": "...",
  "verdict": "TRUE|FALSE|MISLEADING|PARTIALLY_TRUE",
  "confidence": 85,
  "reason": "...",
  "verdict_text": "...",
  "audio_base64": "...",
  "category": "health|science|general|...",
  "key_points": ["..."],
  "fact_details": "...",
  "what_to_know": "...",
  "sources_note": "...",
  "created_at": "2026-02-28T17:31:45.228Z"
}
```
- Indexed on `cache_key` (unique). Cache hit returns in ~200ms vs ~11s for fresh requests.

---

## What's Fully Working ✅
1. Full fact-checking pipeline: URL → Audio → Transcript → Fact-Check → TTS
2. Enhanced context in results (category, key_points, fact_details, what_to_know, sources_note)
3. MongoDB persistent caching (~50x speedup on cache hits)
4. YouTube Shorts + Instagram Reels support
5. 8 Indian languages (Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati)
6. Dark-themed mobile UI
7. Backend deployed on Render, frontend on Cloudflare Pages
8. Health check endpoint for deployment
9. Deployment guide (`DEPLOY.md`)

---

## What's In Progress / Not Yet Working
1. **Android Share Intent**: Custom config plugin (`plugins/withShareIntent.js`) is set up to register Tathya as a share target. The JS code in `index.tsx` handles incoming URLs via `Linking` API. **However, this has NOT been tested on a real APK yet** — the `expo-share-intent` library was removed due to build conflicts with Expo SDK 54. The custom plugin approach needs to be validated with an actual APK build.

2. **APK "Can't connect to server"**: Fixed by hardcoding Render URL as fallback in `useCheckStore.ts` and adding `eas.json` with env vars. Needs verification with a fresh APK build.

---

## Known Issues / Gotchas
1. **`expo-share-intent` library is INCOMPATIBLE with Expo SDK 54** — v6.0.0 needs SDK 55, v5.1.1 has iOS extension conflicts that break EAS builds. We removed it and wrote a custom plugin instead.
2. **RapidAPI dependency**: If the user's subscription lapses or APIs go down, core functionality breaks. The `youtube-mp36` and `instagram-reels-downloader-api` services must stay subscribed.
3. **Render free tier cold starts**: First request after 15 min idle takes ~30s. The app's 2-minute timeout handles this.
4. **pymongo/motor version pinning**: Must use `motor==3.5.1` + `pymongo==4.8.0`. Newer pymongo (4.9+) removes `_QUERY_OPTIONS` which breaks motor.
5. **Metro cache**: If you change dependencies, clear `/app/frontend/.metro-cache` and restart expo.

---

## Future Tasks (Backlog)
- **(P1) Self-hosted video extraction**: Replace RapidAPI with Cobalt/yt-dlp + residential proxies to reduce costs
- **(P1) Robust RapidAPI error handling**: Add retry/fallback logic for transient failures
- **(P2) History screen**: Show past fact-checks (data already in MongoDB)
- **(P2) Re-implement Android share extension**: Validate custom plugin approach with real APK
- **(P3) Code cleanup**: Remove dead YouTube API fallback code in `server.py`

---

## Tried and Failed Approaches
1. **`yt-dlp`** for audio extraction — blocked by YouTube/Instagram bot detection on cloud servers
2. **Public Cobalt API** — dead end, instances were unreliable
3. **`expo-share-intent` npm package** — v6.0.0 needs SDK 55, v5.1.1 creates duplicate iOS extension configs that crash EAS builds even with `disableIOS: true`
4. **Multiple RapidAPI services** (`youtube-mp310`, `youtube-mp3-2025`) — returned 403 (not subscribed). Only `youtube-mp36` works.

---

## How to Continue Development
1. Clone from GitHub: `git clone https://github.com/ayushkushwaha609/SachCheck.git`
2. Backend: Set up `backend/.env` with the API keys listed above
3. Frontend: The preview URL in `frontend/.env` will be auto-set by the Emergent platform
4. The `eas.json` already has the Render URL for APK builds
5. For APK builds: `cd frontend && npm install --legacy-peer-deps && npx eas-cli build --platform android --profile preview`
