# Tathya (तथ्य)

**AI-powered fact-checker for Instagram Reels & YouTube Shorts — in your language.**

Tathya extracts audio from short-form videos, transcribes it, runs an LLM-based fact-check, and reads the verdict back to you via text-to-speech in 6 Indian languages.

### [📥 Download Android APK](https://expo.dev/accounts/ayushkush/projects/tathya/builds/82eaa326-c01e-4821-bfb9-3b6f441258a8)

---

## How It Works

```
Paste URL → Extract Audio → Transcribe → Fact-Check → TTS Verdict
```

1. User pastes an Instagram Reel or YouTube Short URL (or shares directly from those apps)
2. Backend extracts audio via RapidAPI
3. Audio is transcribed using Groq Whisper
4. Claims are analyzed by Groq Llama 3.3 70B — returns verdict, confidence score, category, key points, and detailed reasoning
5. A spoken verdict is generated in the selected language using Sarvam AI TTS
6. Results are cached in MongoDB for instant repeat lookups

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Expo (React Native) · TypeScript · Zustand · Expo Router |
| **Backend** | Python · FastAPI · Pydantic |
| **Database** | MongoDB (via Motor async driver) |
| **Audio Extraction** | RapidAPI (youtube-mp36 + instagram-reels-downloader-api) |
| **Transcription** | Groq Whisper API |
| **Fact-Checking** | Groq Llama 3.3 70B |
| **Text-to-Speech** | Sarvam AI bulbul:v2 |

---

## Supported Languages

| Language | Code |
|---|---|
| Hindi (हिंदी) | `hi-IN` |
| Tamil (தமிழ்) | `ta-IN` |
| Telugu (తెలుగు) | `te-IN` |
| Kannada (ಕನ್ನಡ) | `kn-IN` |
| Malayalam (മലയാളം) | `ml-IN` |
| Marathi (मराठी) | `mr-IN` |

---

## Project Structure

```
├── backend/
│   ├── server.py                 # FastAPI app — /api/check, /api/health
│   ├── Dockerfile                # Production container (Python 3.11 + ffmpeg)
│   ├── render.yaml               # Render deployment blueprint
│   ├── requirements.txt          # Full dev dependencies
│   └── requirements.deploy.txt   # Slim production dependencies
├── frontend/
│   ├── app/
│   │   ├── _layout.tsx           # Root layout (dark theme, share intent provider)
│   │   ├── index.tsx             # Home — URL input, language picker, share intent handler
│   │   └── result.tsx            # Result — verdict card, audio playback
│   ├── components/
│   │   ├── VerdictCard.tsx       # Verdict display with enhanced context fields
│   │   ├── LanguagePicker.tsx    # Language selection modal
│   │   └── LoadingOverlay.tsx    # Loading animation
│   ├── store/
│   │   └── useCheckStore.ts      # Zustand store — API calls, state management
│   ├── constants/
│   │   └── languages.ts          # Language codes and labels
│   └── plugins/
│       └── withShareIntent.js    # Expo config plugin for Android share intent
└── memory/
    └── PRD.md                    # Product requirements document
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **Python** ≥ 3.11
- **MongoDB** (local or Atlas)
- API keys for: **Groq**, **Sarvam AI**, **RapidAPI** (subscribed to `youtube-mp36` and `instagram-reels-downloader-api`)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```
GROQ_API_KEY=your_groq_key
SARVAM_API_KEY=your_sarvam_key
RAPIDAPI_KEY=your_rapidapi_key
MONGO_URL=mongodb://localhost:27017
DB_NAME=tathya_db
```

Run the server:

```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

The API will be available at `http://localhost:8001`. Health check: `GET /api/health`.

### Frontend

```bash
cd frontend
npm install --legacy-peer-deps
```

Create `frontend/.env`:

```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

Start the dev server:

```bash
npx expo start
```

Use the Expo Go app on your phone or press `w` to open the web version.

---

## API

### `POST /api/check`

Fact-check a video URL.

**Request body:**

```json
{
  "url": "https://www.instagram.com/reel/ABC123/",
  "language_code": "hi-IN"
}
```

**Response:** verdict, confidence (0–100), category, key points, detailed reasoning, TTS audio (base64), and regional language translations.

### `GET /api/health`

Returns server status.

---

## Deployment

### Backend (Render — Free Tier)

1. Push to GitHub
2. Create a **Web Service** on [render.com](https://render.com)
3. Set root directory to `backend`, runtime to **Docker**
4. Add environment variables (`GROQ_API_KEY`, `SARVAM_API_KEY`, `RAPIDAPI_KEY`, `MONGO_URL`, `DB_NAME`)

> Free tier sleeps after 15 min of inactivity. First request after sleep takes ~30s.

### Frontend (Cloudflare Pages — Free Tier)

1. Create a project on [pages.cloudflare.com](https://pages.cloudflare.com)
2. Connect your GitHub repo, root directory `frontend`
3. Build command: `npx expo export --platform web`
4. Output directory: `dist`
5. Env vars: `EXPO_PUBLIC_BACKEND_URL=<your-render-url>`, `NODE_VERSION=20`

### Android APK (EAS Build)

> **Pre-built APK**: [Download the latest APK here](https://expo.dev/accounts/ayushkush/projects/tathya/builds/82eaa326-c01e-4821-bfb9-3b6f441258a8)

To build a new APK yourself:

```bash
cd frontend
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

### Database (MongoDB Atlas — Free Tier)

Create a free M0 cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas). The app uses a single collection (`checks`) indexed on `cache_key` (unique).

---

## MongoDB Schema

**Collection: `checks`**

```json
{
  "cache_key": "sha256(url:language_code)",
  "url": "https://...",
  "language_code": "hi-IN",
  "claim": "...",
  "verdict": "TRUE | FALSE | MISLEADING | PARTIALLY_TRUE",
  "confidence": 85,
  "reason": "...",
  "verdict_text": "...",
  "audio_base64": "...",
  "category": "health | science | history | technology | finance | news | general",
  "key_points": ["..."],
  "fact_details": "...",
  "what_to_know": "...",
  "sources_note": "...",
  "created_at": "2026-02-28T17:31:45.228Z"
}
```

---

## License

MIT
